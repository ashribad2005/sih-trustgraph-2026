import json
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Account, Transaction


class Command(BaseCommand):
    help = (
        "Seed transactions from a JSON file. With --process, run every new "
        "transaction through the live rules, ML, graph, evidence, and blockchain pipeline."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="data/transactions_seed.demo.json",
            help="Path to a JSON file, relative to the backend directory or absolute.",
        )
        parser.add_argument(
            "--process",
            action="store_true",
            help="Run seeded transactions through the full fraud-detection pipeline.",
        )

    def _resolve_seed_file(self, requested_path: Path) -> Path | None:
        if requested_path.is_absolute():
            candidates = [requested_path]
        else:
            # The first location is used by the Docker image (WORKDIR=/app).
            # The second keeps compatibility with repository-root invocations.
            candidates = [
                Path(settings.BASE_DIR) / requested_path,
                Path(settings.BASE_DIR).parent / requested_path,
            ]
        return next((candidate for candidate in candidates if candidate.exists()), None)

    def handle(self, *args, **options):
        requested_path = Path(options["file"])
        seed_file = self._resolve_seed_file(requested_path)
        if seed_file is None:
            self.stdout.write(
                self.style.ERROR(f"Seed file not found for requested path: {requested_path}")
            )
            return

        try:
            with seed_file.open("r", encoding="utf-8") as file_handle:
                data = json.load(file_handle)
        except (OSError, json.JSONDecodeError) as exc:
            self.stdout.write(self.style.ERROR(f"Unable to read seed file: {exc}"))
            return

        transactions_list = data.get("transactions", [])
        created_count = 0
        skipped_count = 0
        invalid_count = 0
        case_count = 0
        anchored_count = 0

        pipeline = None
        serializer_class = None
        if options["process"]:
            from api.serializers import TransactionIngestSerializer
            from api.views import TransactionIngestView

            pipeline = TransactionIngestView()
            serializer_class = TransactionIngestSerializer

        for item in transactions_list:
            tx_id = item.get("tx_id")
            if not tx_id:
                invalid_count += 1
                continue

            try:
                if Transaction.objects.filter(tx_id=tx_id).exists():
                    skipped_count += 1
                    continue

                if options["process"]:
                    serializer = serializer_class(data=item)
                    if not serializer.is_valid():
                        invalid_count += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f"Invalid transaction {tx_id}: {serializer.errors}"
                            )
                        )
                        continue

                    result = pipeline._process_transaction(serializer.validated_data)
                    created_count += 1
                    if result.get("case_id"):
                        case_count += 1
                    if result.get("blockchain", {}).get("anchored"):
                        anchored_count += 1
                    continue

                with transaction.atomic():
                    sender_id = item.get("sender_account")
                    receiver_id = item.get("receiver_account")
                    amount = item.get("amount")
                    timestamp_str = item.get("timestamp")

                    if not all([sender_id, receiver_id, amount, timestamp_str]):
                        invalid_count += 1
                        continue

                    if timestamp_str.endswith("Z"):
                        timestamp_str = timestamp_str[:-1] + "+00:00"
                    timestamp = datetime.fromisoformat(timestamp_str)
                    sender, _ = Account.objects.get_or_create(account_id=sender_id)
                    receiver, _ = Account.objects.get_or_create(account_id=receiver_id)

                    Transaction.objects.create(
                        tx_id=tx_id,
                        sender=sender,
                        receiver=receiver,
                        amount=amount,
                        timestamp=timestamp,
                        device_id=item.get("device_id", ""),
                        ip_address=item.get("ip_address", "0.0.0.0"),
                        channel=item.get("channel", "UPI"),
                        status=Transaction.StatusChoices.ALLOWED,
                    )
                    created_count += 1
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"Failed to process {tx_id}: {exc}"))
                invalid_count += 1

        mode = "full pipeline" if options["process"] else "raw transaction import"
        self.stdout.write(self.style.SUCCESS(f"Seed command completed ({mode})."))
        self.stdout.write(f"Created: {created_count}")
        self.stdout.write(f"Skipped: {skipped_count}")
        self.stdout.write(f"Invalid: {invalid_count}")
        if options["process"]:
            self.stdout.write(f"Fraud cases: {case_count}")
            self.stdout.write(f"Blockchain anchors: {anchored_count}")
