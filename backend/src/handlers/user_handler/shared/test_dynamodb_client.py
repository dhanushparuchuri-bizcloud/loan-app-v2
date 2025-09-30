"""
Tests for DynamoDB client helper functions.
"""
import pytest
from unittest.mock import Mock, patch
from moto import mock_dynamodb
import boto3
from shared.dynamodb_client import DynamoDBHelper, TABLE_NAMES


@mock_dynamodb
class TestDynamoDBHelper:
    """Test cases for DynamoDBHelper class."""
    
    def setup_method(self):
        """Set up test environment."""
        # Create mock DynamoDB table
        self.dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        self.table_name = 'test-table'
        
        self.table = self.dynamodb.create_table(
            TableName=self.table_name,
            KeySchema=[
                {'AttributeName': 'id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'id', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
    
    def test_get_item_success(self):
        """Test successful item retrieval."""
        # Put test item
        test_item = {'id': 'test-id', 'name': 'Test Item'}
        self.table.put_item(Item=test_item)
        
        # Get item using helper
        result = DynamoDBHelper.get_item(self.table_name, {'id': 'test-id'})
        
        assert result is not None
        assert result['id'] == 'test-id'
        assert result['name'] == 'Test Item'
    
    def test_get_item_not_found(self):
        """Test item retrieval when item doesn't exist."""
        result = DynamoDBHelper.get_item(self.table_name, {'id': 'nonexistent'})
        assert result is None
    
    def test_put_item_success(self):
        """Test successful item creation."""
        test_item = {'id': 'new-item', 'data': 'test data'}
        
        # Should not raise exception
        DynamoDBHelper.put_item(self.table_name, test_item)
        
        # Verify item was created
        response = self.table.get_item(Key={'id': 'new-item'})
        assert 'Item' in response
        assert response['Item']['data'] == 'test data'
    
    def test_update_item_success(self):
        """Test successful item update."""
        # Create initial item
        self.table.put_item(Item={'id': 'update-test', 'value': 1})
        
        # Update item
        result = DynamoDBHelper.update_item(
            self.table_name,
            {'id': 'update-test'},
            'SET #v = :val',
            {':val': 2},
            {'#v': 'value'}
        )
        
        assert result['value'] == 2
    
    def test_delete_item_success(self):
        """Test successful item deletion."""
        # Create item to delete
        self.table.put_item(Item={'id': 'delete-test', 'data': 'to be deleted'})
        
        # Delete item
        DynamoDBHelper.delete_item(self.table_name, {'id': 'delete-test'})
        
        # Verify item was deleted
        response = self.table.get_item(Key={'id': 'delete-test'})
        assert 'Item' not in response
    
    @patch('shared.dynamodb_client.logger')
    def test_error_handling(self, mock_logger):
        """Test error handling in DynamoDB operations."""
        with pytest.raises(Exception, match="Database operation failed"):
            DynamoDBHelper.get_item('nonexistent-table', {'id': 'test'})
        
        mock_logger.error.assert_called()