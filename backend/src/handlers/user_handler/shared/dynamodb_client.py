"""
DynamoDB client and helper functions for the marketplace backend.
"""
import os
import logging
from typing import Dict, List, Optional, Any, Union
import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger(__name__)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

# Table names from environment variables
TABLE_NAMES = {
    'USERS': os.environ['USERS_TABLE'],
    'LOANS': os.environ['LOANS_TABLE'],
    'LOAN_PARTICIPANTS': os.environ['LOAN_PARTICIPANTS_TABLE'],
    'INVITATIONS': os.environ['INVITATIONS_TABLE'],
    'ACH_DETAILS': os.environ['ACH_DETAILS_TABLE'],
    'PAYMENTS': os.environ.get('PAYMENTS_TABLE', '')
}


class DynamoDBHelper:
    """Helper class for common DynamoDB operations."""
    
    @staticmethod
    def get_item(table_name: str, key: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get a single item from DynamoDB table.
        
        Args:
            table_name: Name of the DynamoDB table
            key: Primary key of the item to retrieve
            
        Returns:
            Item data if found, None otherwise
            
        Raises:
            Exception: If database operation fails
        """
        try:
            table = dynamodb.Table(table_name)
            response = table.get_item(Key=key)
            return response.get('Item')
        except ClientError as e:
            logger.error(f"DynamoDB Get Error: {e}")
            raise Exception("Database operation failed")
    
    @staticmethod
    def put_item(table_name: str, item: Dict[str, Any]) -> None:
        """
        Put an item into DynamoDB table.
        
        Args:
            table_name: Name of the DynamoDB table
            item: Item data to store
            
        Raises:
            Exception: If database operation fails
        """
        try:
            table = dynamodb.Table(table_name)
            table.put_item(Item=item)
        except ClientError as e:
            logger.error(f"DynamoDB Put Error: {e}")
            raise Exception("Database operation failed")
    
    @staticmethod
    def update_item(
        table_name: str,
        key: Dict[str, Any],
        update_expression: str,
        expression_attribute_values: Dict[str, Any],
        expression_attribute_names: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Update an item in DynamoDB table.
        
        Args:
            table_name: Name of the DynamoDB table
            key: Primary key of the item to update
            update_expression: DynamoDB update expression
            expression_attribute_values: Values for the update expression
            expression_attribute_names: Names for the update expression
            
        Returns:
            Updated item attributes
            
        Raises:
            Exception: If database operation fails
        """
        try:
            table = dynamodb.Table(table_name)
            update_params = {
                'Key': key,
                'UpdateExpression': update_expression,
                'ExpressionAttributeValues': expression_attribute_values,
                'ReturnValues': 'ALL_NEW'
            }
            
            if expression_attribute_names:
                update_params['ExpressionAttributeNames'] = expression_attribute_names
            
            response = table.update_item(**update_params)
            return response.get('Attributes', {})
        except ClientError as e:
            logger.error(f"DynamoDB Update Error: {e}")
            raise Exception("Database operation failed")
    
    @staticmethod
    def delete_item(table_name: str, key: Dict[str, Any]) -> None:
        """
        Delete an item from DynamoDB table.
        
        Args:
            table_name: Name of the DynamoDB table
            key: Primary key of the item to delete
            
        Raises:
            Exception: If database operation fails
        """
        try:
            table = dynamodb.Table(table_name)
            table.delete_item(Key=key)
        except ClientError as e:
            logger.error(f"DynamoDB Delete Error: {e}")
            raise Exception("Database operation failed")
    
    @staticmethod
    def query_items(
        table_name: str,
        key_condition_expression: str,
        expression_attribute_values: Dict[str, Any],
        index_name: Optional[str] = None,
        expression_attribute_names: Optional[Dict[str, str]] = None,
        filter_expression: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query items from DynamoDB table.
        
        Args:
            table_name: Name of the DynamoDB table
            key_condition_expression: Key condition for the query
            expression_attribute_values: Values for the query expression
            index_name: Name of the GSI to query (optional)
            expression_attribute_names: Names for the query expression (optional)
            filter_expression: Filter expression (optional)
            
        Returns:
            List of items matching the query
            
        Raises:
            Exception: If database operation fails
        """
        try:
            table = dynamodb.Table(table_name)
            query_params = {
                'KeyConditionExpression': key_condition_expression,
                'ExpressionAttributeValues': expression_attribute_values
            }
            
            if index_name:
                query_params['IndexName'] = index_name
            if expression_attribute_names:
                query_params['ExpressionAttributeNames'] = expression_attribute_names
            if filter_expression:
                query_params['FilterExpression'] = filter_expression
            
            response = table.query(**query_params)
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"DynamoDB Query Error: {e}")
            raise Exception("Database operation failed")
    
    @staticmethod
    def scan_items(
        table_name: str,
        filter_expression: Optional[str] = None,
        expression_attribute_values: Optional[Dict[str, Any]] = None,
        expression_attribute_names: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Scan items from DynamoDB table.
        
        Args:
            table_name: Name of the DynamoDB table
            filter_expression: Filter expression (optional)
            expression_attribute_values: Values for the filter expression (optional)
            expression_attribute_names: Names for the filter expression (optional)
            
        Returns:
            List of items from the scan
            
        Raises:
            Exception: If database operation fails
        """
        try:
            table = dynamodb.Table(table_name)
            scan_params = {}
            
            if filter_expression:
                scan_params['FilterExpression'] = filter_expression
            if expression_attribute_values:
                scan_params['ExpressionAttributeValues'] = expression_attribute_values
            if expression_attribute_names:
                scan_params['ExpressionAttributeNames'] = expression_attribute_names
            
            response = table.scan(**scan_params)
            return response.get('Items', [])
        except ClientError as e:
            logger.error(f"DynamoDB Scan Error: {e}")
            raise Exception("Database operation failed")