#!/usr/bin/env python3
"""
Script to delete ALL data from DynamoDB tables.
WARNING: This is IRREVERSIBLE! Use with extreme caution.

Usage:
    python clear_all_data.py --environment dev
    python clear_all_data.py --environment dev --include-s3

Options:
    --environment: Environment name (dev, staging, production)
    --include-s3: Also clear S3 bucket (default: False)
    --dry-run: Show what would be deleted without actually deleting
"""

import boto3
import argparse
import sys
from typing import List, Dict, Any
from botocore.exceptions import ClientError

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.resource('s3')

# Table definitions with their key schemas
TABLES = {
    'users': {
        'name_template': 'marketplace-users-{env}',
        'primary_key': 'user_id',
        'sort_key': None
    },
    'loans': {
        'name_template': 'marketplace-loans-{env}',
        'primary_key': 'loan_id',
        'sort_key': None
    },
    'loan_participants': {
        'name_template': 'marketplace-loan-participants-{env}',
        'primary_key': 'loan_id',
        'sort_key': 'lender_id'
    },
    'invitations': {
        'name_template': 'marketplace-invitations-{env}',
        'primary_key': 'invitation_id',
        'sort_key': None
    },
    'ach_details': {
        'name_template': 'marketplace-ach-details-{env}',
        'primary_key': 'user_id',
        'sort_key': 'loan_id'
    },
    'payments': {
        'name_template': 'marketplace-payments-{env}',
        'primary_key': 'payment_id',
        'sort_key': None
    },
    'idempotency_keys': {
        'name_template': 'marketplace-idempotency-keys-{env}',
        'primary_key': 'idempotency_key',
        'sort_key': None
    }
}


def get_table_name(table_key: str, environment: str) -> str:
    """Get the full table name for an environment."""
    return TABLES[table_key]['name_template'].format(env=environment)


def scan_table(table_name: str) -> List[Dict[str, Any]]:
    """Scan a DynamoDB table and return all items."""
    table = dynamodb.Table(table_name)
    items = []

    try:
        response = table.scan()
        items.extend(response.get('Items', []))

        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))

        return items
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"⚠️  Table {table_name} does not exist - skipping")
            return []
        raise


def delete_items_from_table(table_key: str, table_name: str, items: List[Dict[str, Any]], dry_run: bool = False) -> int:
    """Delete items from a DynamoDB table."""
    if not items:
        return 0

    table = dynamodb.Table(table_name)
    table_config = TABLES[table_key]
    primary_key = table_config['primary_key']
    sort_key = table_config['sort_key']

    deleted_count = 0

    # Use batch_writer for efficient deletion
    if not dry_run:
        with table.batch_writer() as batch:
            for item in items:
                key = {primary_key: item[primary_key]}
                if sort_key:
                    key[sort_key] = item[sort_key]
                batch.delete_item(Key=key)
                deleted_count += 1
    else:
        deleted_count = len(items)

    return deleted_count


def clear_s3_bucket(bucket_name: str, dry_run: bool = False) -> int:
    """Delete all objects from an S3 bucket."""
    try:
        bucket = s3.Bucket(bucket_name)
        objects_to_delete = []

        # Collect all objects
        for obj in bucket.objects.all():
            objects_to_delete.append({'Key': obj.key})

        if not objects_to_delete:
            return 0

        if not dry_run:
            # Delete in batches of 1000 (AWS limit)
            for i in range(0, len(objects_to_delete), 1000):
                batch = objects_to_delete[i:i+1000]
                bucket.delete_objects(Delete={'Objects': batch})

        return len(objects_to_delete)

    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchBucket':
            print(f"⚠️  Bucket {bucket_name} does not exist - skipping")
            return 0
        raise


def main():
    parser = argparse.ArgumentParser(description='Clear all data from DynamoDB tables')
    parser.add_argument('--environment', '-e', required=True,
                       choices=['dev', 'staging', 'production'],
                       help='Environment to clear (dev, staging, production)')
    parser.add_argument('--include-s3', action='store_true',
                       help='Also clear S3 bucket')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be deleted without actually deleting')

    args = parser.parse_args()

    # Safety check for production
    if args.environment == 'production':
        print("\n" + "="*80)
        print("🚨 WARNING: You are about to delete ALL data from PRODUCTION!")
        print("="*80)
        confirmation = input("\nType 'DELETE PRODUCTION DATA' to confirm: ")
        if confirmation != 'DELETE PRODUCTION DATA':
            print("❌ Aborted. Confirmation did not match.")
            sys.exit(1)
    else:
        print(f"\n⚠️  You are about to delete ALL data from {args.environment.upper()} environment")
        if args.dry_run:
            print("🔍 DRY RUN MODE - No data will be deleted")
        else:
            confirmation = input(f"\nType '{args.environment.upper()}' to confirm: ")
            if confirmation != args.environment.upper():
                print("❌ Aborted. Confirmation did not match.")
                sys.exit(1)

    print("\n" + "="*80)
    print(f"{'DRY RUN: ' if args.dry_run else ''}Clearing data from {args.environment} environment")
    print("="*80 + "\n")

    total_deleted = 0

    # Clear each DynamoDB table
    for table_key in TABLES.keys():
        table_name = get_table_name(table_key, args.environment)
        print(f"📊 Processing table: {table_name}")

        # Scan table
        items = scan_table(table_name)
        print(f"   Found {len(items)} items")

        if items:
            # Delete items
            deleted = delete_items_from_table(table_key, table_name, items, args.dry_run)
            print(f"   {'Would delete' if args.dry_run else 'Deleted'} {deleted} items ✓")
            total_deleted += deleted
        else:
            print(f"   Table is empty - skipping")

        print()

    # Clear S3 bucket if requested
    if args.include_s3:
        # Get AWS account ID
        sts = boto3.client('sts')
        account_id = sts.get_caller_identity()['Account']

        bucket_name = f"payment-receipts-{args.environment}-{account_id}"
        print(f"🪣 Processing S3 bucket: {bucket_name}")

        deleted_objects = clear_s3_bucket(bucket_name, args.dry_run)
        if deleted_objects > 0:
            print(f"   {'Would delete' if args.dry_run else 'Deleted'} {deleted_objects} objects ✓")
        else:
            print(f"   Bucket is empty - skipping")
        print()

    print("="*80)
    print(f"{'DRY RUN: ' if args.dry_run else ''}Summary")
    print("="*80)
    print(f"Total items {'that would be deleted' if args.dry_run else 'deleted'}: {total_deleted}")

    if args.dry_run:
        print("\n✅ Dry run completed. No data was deleted.")
        print("   Run without --dry-run to actually delete the data.")
    else:
        print(f"\n✅ All data cleared from {args.environment} environment!")
        print("   Your database is now empty and ready for fresh data.")


if __name__ == '__main__':
    main()
