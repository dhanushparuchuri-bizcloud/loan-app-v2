

def handle_add_lenders(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add lenders to an existing loan.
    POST /loans/{loan_id}/lenders

    Allows borrowers to incrementally invite lenders to pending loans.
    """
    try:
        # Authenticate user
        user = JWTAuth.authenticate_user(event)

        # Get loan ID from path
        path = event.get('path', '')
        loan_id = path.split('/')[-2]  # Extract from /loans/{id}/lenders

        # Validate loan ID
        ValidationHelper.validate_uuid_param(loan_id, 'loan_id')

        logger.info(f"Adding lenders to loan: {loan_id}, user: {user.user_id}")

        # Get loan
        loan = DynamoDBHelper.get_item(TABLE_NAMES['LOANS'], {'loan_id': loan_id})
        if not loan:
            return ResponseHelper.not_found_response('Loan not found')

        # Verify user is the borrower
        if loan['borrower_id'] != user.user_id:
            return ResponseHelper.forbidden_response('Only the loan creator can add lenders')

        # Verify loan is still PENDING
        if loan['status'] != LoanStatus.PENDING:
            return ResponseHelper.validation_error_response(
                f'Cannot add lenders to {loan["status"]} loan. Only PENDING loans can be modified.'
            )

        # Parse new lenders from request body
        body = json.loads(event.get('body', '{}'))
        lender_data = body.get('lenders', [])

        if not lender_data:
            return ResponseHelper.validation_error_response('No lenders provided')

        # Validate new lenders
        new_lenders = []
        for lender in lender_data:
            try:
                validated = ValidationHelper.validate_request_body(LenderInviteRequest, lender)
                new_lenders.append(validated)
            except ValueError as e:
                return ResponseHelper.validation_error_response(f'Invalid lender data: {str(e)}')

        # Calculate current total invited
        current_invited = calculate_total_invited(loan_id)
        new_contributions = sum(float(l.contribution_amount) for l in new_lenders)
        total_after_add = current_invited + new_contributions

        logger.info(f"Current invited: {current_invited}, New: {new_contributions}, Total after: {total_after_add}, Loan amount: {loan['amount']}")

        # Validate total doesn't exceed loan amount
        if total_after_add > float(loan['amount']):
            return ResponseHelper.validation_error_response(
                f"Total invitations ({total_after_add}) would exceed loan amount ({loan['amount']}). "
                f"Current invited: {current_invited}, Remaining available: {float(loan['amount']) - current_invited}"
            )

        # Validate borrower not inviting themselves
        user_email_lower = user.email.lower()
        for lender in new_lenders:
            if lender.email.lower() == user_email_lower:
                return ResponseHelper.validation_error_response(
                    "You cannot invite yourself as a lender to your own loan"
                )

        # Create invitations
        now = datetime.now(timezone.utc).isoformat()
        invitation_results = create_lender_invitations(
            loan_id, user.user_id, new_lenders, now
        )

        # Prepare response
        response_data = {
            'loan_id': loan_id,
            'lenders_added': len(new_lenders),
            'invitations_created': invitation_results['invitations_created'],
            'participants_created': invitation_results['participants_created'],
            'total_invited': total_after_add,
            'remaining': float(loan['amount']) - total_after_add,
            'is_fully_invited': total_after_add >= float(loan['amount'])
        }

        logger.info(f"Successfully added {len(new_lenders)} lenders to loan {loan_id}")
        return ResponseHelper.success_response(response_data, 'Lenders added successfully')

    except ValueError as e:
        logger.error(f"Add lenders validation error: {str(e)}")
        return ResponseHelper.validation_error_response(str(e))
    except Exception as e:
        logger.error(f"Add lenders error: {str(e)}")
        return ResponseHelper.handle_exception(e)


def calculate_total_invited(loan_id: str) -> float:
    """
    Calculate total contribution amount for all participants (pending + accepted).

    Args:
        loan_id: Loan ID

    Returns:
        Total invited amount
    """
    participants = DynamoDBHelper.query_items(
        TABLE_NAMES['LOAN_PARTICIPANTS'],
        'loan_id = :loan_id',
        {':loan_id': loan_id}
    )

    total = sum(float(p['contribution_amount']) for p in participants)
    logger.info(f"Calculated total invited for loan {loan_id}: {total} ({len(participants)} participants)")
    return total
