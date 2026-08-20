import json
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Account, Transaction
from datetime import datetime

class Command(BaseCommand):
    help = 'Seeds transactions from data/transactions_seed.json'

    def handle(self, *args, **kwargs):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        seed_file = os.path.join(base_dir, 'data', 'transactions_seed.json')

        if not os.path.exists(seed_file):
            self.stdout.write(self.style.ERROR(f'Seed file not found at {seed_file}'))
            return

        with open(seed_file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                self.stdout.write(self.style.ERROR('Invalid JSON in seed file.'))
                return

        transactions_list = data.get('transactions', [])
        
        created_count = 0
        skipped_count = 0
        invalid_count = 0

        for item in transactions_list:
            tx_id = item.get('tx_id')
            if not tx_id:
                invalid_count += 1
                continue

            try:
                with transaction.atomic():
                    if Transaction.objects.filter(tx_id=tx_id).exists():
                        skipped_count += 1
                        continue
                    
                    sender_id = item.get('sender_account')
                    receiver_id = item.get('receiver_account')
                    amount = item.get('amount')
                    timestamp_str = item.get('timestamp')
                    
                    if not all([sender_id, receiver_id, amount, timestamp_str]):
                        invalid_count += 1
                        continue
                        
                    # Support basic ISO format. Replace Z with +00:00 for python 3.10- compat or just handle standard formats.
                    if timestamp_str.endswith('Z'):
                        timestamp_str = timestamp_str[:-1] + '+00:00'
                    timestamp = datetime.fromisoformat(timestamp_str)
                    
                    sender, _ = Account.objects.get_or_create(account_id=sender_id)
                    receiver, _ = Account.objects.get_or_create(account_id=receiver_id)

                    Transaction.objects.create(
                        tx_id=tx_id,
                        sender=sender,
                        receiver=receiver,
                        amount=amount,
                        timestamp=timestamp,
                        device_id=item.get('device_id', ''),
                        ip_address=item.get('ip_address', '0.0.0.0'),
                        channel=item.get('channel', 'UPI'),
                        status=Transaction.StatusChoices.ALLOWED
                    )
                    created_count += 1
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Failed to process {tx_id}: {e}'))
                invalid_count += 1

        self.stdout.write(self.style.SUCCESS(f'Seed command completed.'))
        self.stdout.write(f'Created: {created_count}')
        self.stdout.write(f'Skipped: {skipped_count}')
        self.stdout.write(f'Invalid: {invalid_count}')
