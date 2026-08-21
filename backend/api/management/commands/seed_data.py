import json
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Account, Transaction


class Command(BaseCommand):
    help = "Seed transactions from a JSON file without requiring a generated bulk dataset."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="data/transactions_seed.sample.json",
            help="Path to a JSON file, relative to the repository root or absolute.",
        )

    def handle(self, *args, **options):
        requested_path = Path(options["file"])
        seed_file = (
            requested_path
            if requested_path.is_absolute()
            else Path(settings.BASE_DIR).parent / requested_path
        )

        if not seed_file.exists():
            self.stdout.write(self.style.ERROR(f"Seed file not found at {seed_file}"))
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

        for item in transactions_list:
            tx_id = item.get("tx_id")
            if not tx_id:
                invalid_count += 1
                continue

            try:
                with transaction.atomic():
                    if Transaction.objects.filter(tx_id=tx_id).exists():
                        skipped_count += 1
                        continue

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

        self.stdout.write(self.style.SUCCESS("Seed command completed."))
        self.stdout.write(f"Created: {created_count}")
        self.stdout.write(f"Skipped: {skipped_count}")
        self.stdout.write(f"Invalid: {invalid_count}")
