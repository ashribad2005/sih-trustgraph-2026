import pandas as pd
import random
import json
import os
from datetime import datetime, timedelta
from faker import Faker


# ============================================================
# CONFIGURATION
# ============================================================

TOTAL_NORMAL_TX = 50000

START_DATE = datetime(2026, 8, 16, 8, 0, 0)

# Fixed seed:
# Running the generator again produces the same dataset.
SEED = 42

random.seed(SEED)
Faker.seed(SEED)

fake = Faker("en_IN")


CHANNELS = [
    "UPI",
    "IMPS",
    "NEFT"
]


LOCATIONS = [
    "Mumbai, IN",
    "Delhi, IN",
    "Bhubaneswar, IN",
    "Bangalore, IN",
    "Hyderabad, IN",
    "Kolkata, IN",
    "Chennai, IN",
    "Pune, IN"
]


BANK_HANDLES = [
    "okhdfcbank",
    "okicici",
    "ybl",
    "oksbi",
    "paytm"
]


MERCHANT_CATEGORIES = [
    "Grocery",
    "Food",
    "Shopping",
    "Travel",
    "Utilities",
    "Entertainment"
]


# ============================================================
# FRAUD SCENARIO CONFIGURATION
# ============================================================

# Scenario A:
# 30 independent mule rings.
# Each ring = 10 incoming + 1 outgoing transaction.
NUM_MULE_RINGS = 30


# Scenario B:
# 40 independent velocity bursts.
# Each burst = 15 transactions.
NUM_VELOCITY_BURSTS = 40


# Scenario C:
# 10 account takeover cases.
NUM_TAKEOVERS = 10


# Rule 03:
# 10 new-account high-value transactions.
NUM_RULE03_CASES = 10


# ============================================================
# DETERMINISTIC ID GENERATOR
# ============================================================

id_counters = {}


def generate_id(prefix):
    """
    Generate deterministic IDs.

    Unlike uuid.uuid4(), this produces the same IDs
    every time the generator runs with the same seed.
    """

    if prefix not in id_counters:
        id_counters[prefix] = 0

    id_counters[prefix] += 1

    return f"{prefix}_{id_counters[prefix]:08d}"


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def generate_ip():
    """
    Generate a simulated IPv4 address.
    """

    return (
        f"{random.randint(10, 223)}."
        f"{random.randint(0, 255)}."
        f"{random.randint(0, 255)}."
        f"{random.randint(1, 254)}"
    )


def generate_upi(name=None):
    """
    Generate a simulated Indian UPI ID.
    """

    if name is None:
        name = fake.first_name()

    name = "".join(
        ch for ch in name.lower()
        if ch.isalnum()
    )

    return (
        f"{name}"
        f"{random.randint(100, 9999)}"
        f"@{random.choice(BANK_HANDLES)}"
    )


# ============================================================
# CREATE ACCOUNT / DEVICE / IP POOLS
# ============================================================

print("=" * 70)
print("TRUSTGRAPH - SYNTHETIC FRAUD DATA GENERATOR")
print("=" * 70)

print()
print("Generating entity pools...")


NUM_ACCOUNTS = 5000
NUM_DEVICES = 3000
NUM_IPS = 3000


accounts = []


for _ in range(NUM_ACCOUNTS):

    name = fake.name()

    # Normal accounts are older than 7 days.
    account_age_days = random.randint(7, 365)

    account_created_at = (
        START_DATE
        - timedelta(days=account_age_days)
    )

    account = {

        "account": generate_upi(name),

        "name": name,

        "account_age_days": account_age_days,

        "account_created_at": account_created_at,

        "normal_device": None,

        "normal_ip": None,

        "normal_location": None,

        "last_transaction_at": None
    }

    accounts.append(account)


# ============================================================
# DEVICE POOL
# ============================================================

devices = [
    generate_id("DEV")
    for _ in range(NUM_DEVICES)
]


# ============================================================
# IP POOL
# ============================================================

ips = [
    generate_ip()
    for _ in range(NUM_IPS)
]


# ============================================================
# ASSIGN NORMAL DEVICES / IPS
# ============================================================

for account in accounts:

    account["normal_device"] = random.choice(
        devices
    )

    account["normal_ip"] = random.choice(
        ips
    )

    account["normal_location"] = random.choice(
        LOCATIONS
    )


# Keep a copy of the normal accounts.
# Fraud scenarios will use these accounts too.
normal_sender_accounts = accounts.copy()


transactions = []


# ============================================================
# 1. NORMAL TRAFFIC
# ============================================================

print()
print(
    f"Generating {TOTAL_NORMAL_TX:,} normal transactions..."
)


for _ in range(TOTAL_NORMAL_TX):

    sender = random.choice(
        normal_sender_accounts
    )


    receiver = random.choice(
        normal_sender_accounts
    )


    # Prevent self-transfer.
    while receiver["account"] == sender["account"]:

        receiver = random.choice(
            normal_sender_accounts
        )


    # Normal transaction timestamp.
    timestamp = (
        START_DATE
        + timedelta(
            minutes=random.randint(0, 10000)
        )
    )


    # --------------------------------------------------------
    # P2P TRANSACTION
    # --------------------------------------------------------

    if random.random() < 0.80:

        transaction_type = "P2P"

        merchant_category = "Not_Applicable"

        receiver_account = receiver["account"]


    # --------------------------------------------------------
    # MERCHANT TRANSACTION
    # --------------------------------------------------------

    else:

        transaction_type = "MERCHANT"

        merchant_category = random.choice(
            MERCHANT_CATEGORIES
        )

        receiver_account = generate_upi(
            "merchant"
        )


    # Normal transaction amounts.
    amount = round(
        random.uniform(100, 15000),
        2
    )


    tx = {

        "tx_id": generate_id("TXN"),

        "timestamp": (
            timestamp.isoformat() + "Z"
        ),

        "sender_account": sender["account"],

        "receiver_account": receiver_account,

        "amount": amount,

        "channel": random.choice(CHANNELS),

        "transaction_type": transaction_type,

        "merchant_category": merchant_category,

        "device_id": sender["normal_device"],

        "ip_address": sender["normal_ip"],

        "location": sender["normal_location"],

        "account_age_days": sender["account_age_days"],

        "account_created_at": (
            sender["account_created_at"].isoformat()
        ),

        "last_transaction_at": (
            sender["last_transaction_at"].isoformat()
            if sender["last_transaction_at"]
            else None
        ),

        "is_fraud": 0,

        "fraud_scenario": (
            "Scenario D - Normal Traffic"
        )
    }


    transactions.append(tx)


    # Update last transaction time.
    sender["last_transaction_at"] = timestamp


# ============================================================
# 2. SCENARIO A
# MULE FUNNEL / SMURFING
#
# 30 independent mule rings.
#
# Each ring:
#
# 10 different sender accounts
#        ↓
#     mule account
#        ↓
#     ₹95,000 exit
#
# 10 × ₹9,500 = ₹95,000
# ============================================================

print()
print(
    "Injecting Scenario A: Mule Funnel / Smurfing..."
)


for ring in range(NUM_MULE_RINGS):

    mule_account = generate_upi(
        f"mule{ring}"
    )


    exit_account = generate_upi(
        f"exit{ring}"
    )


    mule_device = generate_id(
        "DEV_MULE"
    )


    mule_ip = generate_ip()


    mule_time = (
        START_DATE
        + timedelta(
            minutes=5000 + ring * 20
        )
    )


    # Exactly ₹95,000.
    sender_amounts = [
        9500
        for _ in range(10)
    ]


    total_aggregated = sum(
        sender_amounts
    )


    # 10 DISTINCT sender accounts.
    mule_senders = random.sample(
        normal_sender_accounts,
        10
    )


    # --------------------------------------------------------
    # FAN-IN
    # --------------------------------------------------------

    for i, (sender, amount) in enumerate(
        zip(
            mule_senders,
            sender_amounts
        )
    ):

        timestamp = (
            mule_time
            + timedelta(minutes=i)
        )


        transactions.append({

            "tx_id": generate_id("TXN"),

            "timestamp": (
                timestamp.isoformat() + "Z"
            ),

            "sender_account": sender["account"],

            "receiver_account": mule_account,

            "amount": amount,

            "channel": "UPI",

            "transaction_type": "P2P",

            "merchant_category": "Not_Applicable",

            "device_id": sender["normal_device"],

            "ip_address": sender["normal_ip"],

            "location": "Delhi, IN",

            "account_age_days": (
                sender["account_age_days"]
            ),

            "account_created_at": (
                sender["account_created_at"].isoformat()
            ),

            "last_transaction_at": (
                sender["last_transaction_at"].isoformat()
                if sender["last_transaction_at"]
                else None
            ),

            "is_fraud": 1,

            "fraud_scenario": (
                "Scenario A - Mule Fan-In"
            )
        })


    # --------------------------------------------------------
    # FAN-OUT
    # --------------------------------------------------------

    # Outflow occurs 9 minutes after first inflow.
    outflow_time = (
        mule_time
        + timedelta(minutes=9)
    )


    transactions.append({

        "tx_id": generate_id("TXN"),

        "timestamp": (
            outflow_time.isoformat() + "Z"
        ),

        "sender_account": mule_account,

        "receiver_account": exit_account,

        "amount": total_aggregated,

        "channel": "IMPS",

        "transaction_type": "P2P",

        "merchant_category": "Not_Applicable",

        "device_id": mule_device,

        "ip_address": mule_ip,

        "location": "Delhi, IN",

        "account_age_days": 120,

        "account_created_at": (
            START_DATE
            - timedelta(days=120)
        ).isoformat(),

        "last_transaction_at": (
            mule_time
            + timedelta(minutes=8)
        ).isoformat(),

        "is_fraud": 1,

        "fraud_scenario": (
            "Scenario A - Mule Fan-Out"
        )
    })


# ============================================================
# 3. SCENARIO B
# RAPID VELOCITY BURST
#
# 40 independent bursts.
#
# Each burst:
# 15 transactions
# < ₹2,000 each
# within approximately 4 minutes
# ============================================================

print()
print(
    "Injecting Scenario B: Rapid Velocity Burst..."
)


for burst in range(
    NUM_VELOCITY_BURSTS
):

    burst_sender = random.choice(
        normal_sender_accounts
    )


    burst_receiver = generate_upi(
        f"receiver{burst}"
    )


    burst_time = (
        START_DATE
        + timedelta(
            minutes=7000 + burst * 20
        )
    )


    burst_device = (
        burst_sender["normal_device"]
    )


    burst_ip = (
        burst_sender["normal_ip"]
    )


    for i in range(15):

        # 14-second intervals.
        # 15 transactions finish within 3 minutes 16 seconds.
        timestamp = (
            burst_time
            + timedelta(
                seconds=i * 14
            )
        )


        transactions.append({

            "tx_id": generate_id("TXN"),

            "timestamp": (
                timestamp.isoformat() + "Z"
            ),

            "sender_account": (
                burst_sender["account"]
            ),

            "receiver_account": (
                burst_receiver
            ),

            "amount": round(
                random.uniform(
                    1500,
                    1999
                ),
                2
            ),

            "channel": "UPI",

            "transaction_type": "P2P",

            "merchant_category": "Not_Applicable",

            "device_id": burst_device,

            "ip_address": burst_ip,

            "location": "Mumbai, IN",

            "account_age_days": (
                burst_sender[
                    "account_age_days"
                ]
            ),

            "account_created_at": (
                burst_sender[
                    "account_created_at"
                ].isoformat()
            ),

            "last_transaction_at": (
                burst_sender[
                    "last_transaction_at"
                ].isoformat()
                if burst_sender[
                    "last_transaction_at"
                ]
                else None
            ),

            "is_fraud": 1,

            "fraud_scenario": (
                "Scenario B - Velocity Burst"
            )
        })


# ============================================================
# 4. SCENARIO C
# DEVICE HOPPING / ACCOUNT TAKEOVER
#
# 10 independent takeover cases.
#
# Account dormant for 60 days
# → ₹85,000 transfer
# → unfamiliar device
# → unfamiliar IP
# ============================================================

print()
print(
    "Injecting Scenario C: Device Hopping / Account Takeover..."
)


takeover_candidates = random.sample(
    normal_sender_accounts,
    NUM_TAKEOVERS
)


for case, victim in enumerate(
    takeover_candidates
):

    takeover_time = (
        START_DATE
        + timedelta(
            minutes=2000 + case * 25
        )
    )


    # Exactly 60 days of dormancy.
    dormant_since = (
        takeover_time
        - timedelta(days=60)
    )


    unfamiliar_device = generate_id(
        "DEV_UNKNOWN"
    )


    unfamiliar_ip = generate_ip()


    # Make sure IP is different.
    while unfamiliar_ip == victim["normal_ip"]:

        unfamiliar_ip = generate_ip()


    unfamiliar_location = (
        "Kolkata, IN"
    )


    transactions.append({

        "tx_id": generate_id("TXN"),

        "timestamp": (
            takeover_time.isoformat() + "Z"
        ),

        "sender_account": victim["account"],

        "receiver_account": generate_upi(
            f"exit{case}"
        ),

        "amount": 85000,

        "channel": "IMPS",

        "transaction_type": "P2P",

        "merchant_category": "Not_Applicable",

        "device_id": unfamiliar_device,

        "ip_address": unfamiliar_ip,

        "location": unfamiliar_location,

        "account_age_days": (
            victim["account_age_days"]
        ),

        "account_created_at": (
            victim["account_created_at"].isoformat()
        ),

        "last_transaction_at": (
            dormant_since.isoformat()
        ),

        "is_fraud": 1,

        "fraud_scenario": (
            "Scenario C - Account Takeover"
        )
    })


# ============================================================
# 5. RULE 03 TEST CASE
#
# Amount > ₹1,00,000
# AND account age < 7 days
#
# 10 independent examples.
# ============================================================

print()
print(
    "Injecting Rule 03 cases: "
    "New Account + High Amount..."
)


for case in range(
    NUM_RULE03_CASES
):

    account_age = random.randint(
        1,
        6
    )


    created_at = (
        START_DATE
        - timedelta(
            days=account_age
        )
    )


    new_account = {

        "account": generate_upi(
            f"newuser{case}"
        ),

        "account_age_days": account_age,

        "account_created_at": created_at,

        "normal_device": generate_id(
            "DEV_NEW"
        ),

        "normal_ip": generate_ip(),

        "normal_location": "Mumbai, IN"
    }


    rule03_time = (
        START_DATE
        + timedelta(
            minutes=8000 + case * 10
        )
    )


    transactions.append({

        "tx_id": generate_id("TXN"),

        "timestamp": (
            rule03_time.isoformat() + "Z"
        ),

        "sender_account": (
            new_account["account"]
        ),

        "receiver_account": generate_upi(
            f"receiver_new{case}"
        ),

        "amount": random.randint(
            100001,
            150000
        ),

        "channel": "IMPS",

        "transaction_type": "P2P",

        "merchant_category": "Not_Applicable",

        "device_id": (
            new_account["normal_device"]
        ),

        "ip_address": (
            new_account["normal_ip"]
        ),

        "location": (
            new_account["normal_location"]
        ),

        "account_age_days": (
            new_account["account_age_days"]
        ),

        "account_created_at": (
            new_account[
                "account_created_at"
            ].isoformat()
        ),

        "last_transaction_at": None,

        "is_fraud": 1,

        "fraud_scenario": (
            "Rule 03 - New Account High Amount"
        )
    })


# ============================================================
# 6. SHUFFLE DATA
# ============================================================

print()
print("Shuffling transactions...")

random.shuffle(transactions)


# ============================================================
# 7. CREATE DATAFRAME
# ============================================================

df = pd.DataFrame(
    transactions
)


# ============================================================
# 8. CREATE DATA DIRECTORY
# ============================================================

os.makedirs(
    "data",
    exist_ok=True
)


# ============================================================
# 9. SAVE CSV
# ============================================================

csv_path = (
    "data/transactions_stream.csv"
)


df.to_csv(
    csv_path,
    index=False
)


# ============================================================
# 10. SAVE JSON
# ============================================================

json_path = (
    "data/transactions_seed.json"
)


with open(
    json_path,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        transactions,
        f,
        indent=4,
        default=str
    )


# ============================================================
# 11. VALIDATION
# ============================================================

print()
print("=" * 70)
print("DATASET GENERATION COMPLETE")
print("=" * 70)


total_rows = len(df)


normal_rows = len(
    df[
        df["is_fraud"] == 0
    ]
)


fraud_rows = len(
    df[
        df["is_fraud"] == 1
    ]
)


fraud_rate = (
    fraud_rows
    / total_rows
    * 100
)


print()
print(
    f"Total transactions : {total_rows:,}"
)


print(
    f"Normal transactions: {normal_rows:,}"
)


print(
    f"Fraud transactions : {fraud_rows:,}"
)


print(
    f"Fraud rate         : {fraud_rate:.2f}%"
)


print()
print("Fraud / scenario counts:")
print()


print(
    df["fraud_scenario"]
    .value_counts()
)


# ============================================================
# 12. DATA QUALITY CHECK
# ============================================================

print()
print("Missing values:")


print(
    df.isnull().sum()
)


# ============================================================
# 13. EXPECTED DATASET SIZE CHECK
# ============================================================

expected_rows = (
    TOTAL_NORMAL_TX
    + (NUM_MULE_RINGS * 11)
    + (NUM_VELOCITY_BURSTS * 15)
    + NUM_TAKEOVERS
    + NUM_RULE03_CASES
)


print()
print(
    f"Expected rows      : {expected_rows:,}"
)


if total_rows == expected_rows:

    print(
        "Dataset size check : PASS"
    )

else:

    print(
        "Dataset size check : FAIL"
    )


# ============================================================
# 14. DETERMINISM INFORMATION
# ============================================================

print()
print(
    "Random seed         : 42"
)


print(
    "Deterministic IDs   : YES"
)


print(
    "Dataset reproducible: YES"
)


# ============================================================
# 15. OUTPUT FILES
# ============================================================

print()
print(
    f"CSV  : {csv_path}"
)


print(
    f"JSON : {json_path}"
)


print()
print("=" * 70)
print("GENERATOR FINISHED")
print("=" * 70)