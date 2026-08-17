import pandas as pd
import json
import os


# ============================================================
# CONFIGURATION
# ============================================================

CSV_PATH = "data/transactions_stream.csv"
ALERTS_PATH = "data/rule_alerts.json"

VELOCITY_WINDOW_MINUTES = 5
VELOCITY_THRESHOLD = 8

OUTFLOW_WINDOW_MINUTES = 10
OUTFLOW_RATIO_THRESHOLD = 0.90

NEW_ACCOUNT_DAYS = 7
HIGH_AMOUNT_THRESHOLD = 100000


# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(CSV_PATH)

df["timestamp"] = pd.to_datetime(df["timestamp"])
df["amount"] = pd.to_numeric(df["amount"])


# ============================================================
# RULE 01
# VELOCITY > 8 TRANSACTIONS IN 5 MINUTES
# ============================================================

def rule_01_velocity(data):

    alerts = []

    for account, group in data.groupby("sender_account"):

        group = group.sort_values("timestamp").reset_index(drop=True)

        for i in range(len(group)):

            window_start = group.loc[i, "timestamp"]

            window_end = (
                window_start
                + pd.Timedelta(
                    minutes=VELOCITY_WINDOW_MINUTES
                )
            )

            window = group[
                (group["timestamp"] >= window_start)
                & (group["timestamp"] <= window_end)
            ]

            if len(window) > VELOCITY_THRESHOLD:

                alerts.append({
                    "rule_id": "RULE_01",
                    "account": account,
                    "timestamp": window_start,
                    "transaction_count": len(window),
                    "reason": (
                        f"More than {VELOCITY_THRESHOLD} "
                        f"transactions within "
                        f"{VELOCITY_WINDOW_MINUTES} minutes"
                    )
                })

                # One alert per suspicious account
                break

    return alerts


# ============================================================
# RULE 02
# INFLOW → IMMEDIATE OUTFLOW > 90%
# WITHIN 10 MINUTES
#
# Detects a mule-style funnel:
# multiple incoming transactions to the same account
# followed by a large outgoing transaction.
# ============================================================

def rule_02_mule_outflow(data):

    alerts = []

    # Group transactions by receiver account.
    for account, account_data in data.groupby(
        "receiver_account"
    ):

        inflows = (
            account_data
            .sort_values("timestamp")
            .copy()
        )

        # Find transactions where this same account
        # is later the sender.
        outflows = data[
            data["sender_account"] == account
        ].sort_values("timestamp").copy()

        if outflows.empty:
            continue

        # Check each possible outflow.
        for _, outflow in outflows.iterrows():

            outflow_time = outflow["timestamp"]

            window_start = (
                outflow_time
                - pd.Timedelta(
                    minutes=OUTFLOW_WINDOW_MINUTES
                )
            )

            # Inflows received during the previous 10 minutes.
            recent_inflows = inflows[
                (inflows["timestamp"] < outflow_time)
                & (
                    inflows["timestamp"]
                    >= window_start
                )
            ]

            if recent_inflows.empty:
                continue

            total_inflow = (
                recent_inflows["amount"].sum()
            )

            if total_inflow <= 0:
                continue

            outflow_ratio = (
                outflow["amount"]
                / total_inflow
            )

            # RULE_02 condition
            if outflow_ratio > OUTFLOW_RATIO_THRESHOLD:

                # Require multiple incoming transactions.
                if len(recent_inflows) >= 3:

                    alerts.append({
                        "rule_id": "RULE_02",
                        "account": account,
                        "timestamp": outflow_time,
                        "inflow": round(
                            total_inflow,
                            2
                        ),
                        "outflow": round(
                            outflow["amount"],
                            2
                        ),
                        "outflow_ratio": round(
                            outflow_ratio,
                            4
                        ),
                        "inflow_transaction_count": len(
                            recent_inflows
                        ),
                        "reason": (
                            "Multiple incoming transactions "
                            "followed by an outflow of more "
                            "than 90% within 10 minutes"
                        )
                    })

                    # One alert per suspicious account.
                    break

    return alerts


# ============================================================
# RULE 03
# AMOUNT > ₹1,00,000
# AND ACCOUNT AGE < 7 DAYS
# ============================================================

def rule_03_new_account(data):

    alerts = []

    matches = data[
        (data["amount"] > HIGH_AMOUNT_THRESHOLD)
        & (
            data["account_age_days"]
            < NEW_ACCOUNT_DAYS
        )
    ]

    for _, row in matches.iterrows():

        alerts.append({
            "rule_id": "RULE_03",
            "account": row["sender_account"],
            "timestamp": row["timestamp"],
            "amount": row["amount"],
            "account_age_days": (
                row["account_age_days"]
            ),
            "reason": (
                "High-value transaction from "
                "an account less than 7 days old"
            )
        })

    return alerts


# ============================================================
# RUN RULE ENGINE
# ============================================================

print("=" * 60)
print("TRUSTGRAPH - LAYER 1 RULE ENGINE")
print("=" * 60)


rule_01_alerts = rule_01_velocity(df)

print()
print(
    f"RULE_01 alerts: "
    f"{len(rule_01_alerts)}"
)


rule_02_alerts = rule_02_mule_outflow(df)

print(
    f"RULE_02 alerts: "
    f"{len(rule_02_alerts)}"
)


rule_03_alerts = rule_03_new_account(df)

print(
    f"RULE_03 alerts: "
    f"{len(rule_03_alerts)}"
)


# ============================================================
# COMBINE ALERTS
# ============================================================

all_alerts = (
    rule_01_alerts
    + rule_02_alerts
    + rule_03_alerts
)


print()
print("=" * 60)
print(
    "TOTAL RULE ENGINE ALERTS:",
    len(all_alerts)
)
print("=" * 60)


# ============================================================
# CONVERT TIMESTAMPS FOR JSON
# ============================================================

# pandas Timestamp objects cannot be directly written
# to JSON, so convert them to ISO-format strings.

json_alerts = []

for alert in all_alerts:

    clean_alert = alert.copy()

    if isinstance(
        clean_alert.get("timestamp"),
        pd.Timestamp
    ):

        clean_alert["timestamp"] = (
            clean_alert["timestamp"]
            .isoformat()
        )

    # Convert NumPy numeric values to normal Python values.
    for key, value in clean_alert.items():

        if hasattr(value, "item"):

            clean_alert[key] = value.item()

    json_alerts.append(clean_alert)


# ============================================================
# SAVE ALERTS TO JSON
# ============================================================

os.makedirs(
    "data",
    exist_ok=True
)


with open(
    ALERTS_PATH,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        json_alerts,
        file,
        indent=4
    )


print()
print(
    f"Alert file saved: {ALERTS_PATH}"
)


# ============================================================
# DISPLAY ALERTS
# ============================================================

for alert in all_alerts:

    print()

    print(
        f"[{alert['rule_id']}] "
        f"{alert['account']} "
        f"→ {alert['reason']}"
    )


# ============================================================
# FINAL SUMMARY
# ============================================================

print()
print("=" * 60)
print("RULE ENGINE COMPLETE")
print("=" * 60)

print(
    f"Total alerts : {len(all_alerts)}"
)

print(
    f"JSON output  : {ALERTS_PATH}"
)

print("=" * 60)