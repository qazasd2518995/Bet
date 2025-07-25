# Period 20250717362 Analysis Report

## Executive Summary

User **justin111** won despite active loss control being set at 90%. The member bet $9 total on position 5 (numbers 2-10) and won $9.89 when number 6 came up, resulting in a net profit of $0.89.

## Detailed Findings

### 1. Betting Activity
- **User**: justin111 (member)
- **Total Bets**: 9 bets of $1 each = $9 total
- **Bet Type**: Individual number bets on position 5
- **Coverage**: 9 out of 10 numbers (2,3,4,5,6,7,8,9,10)
- **Missing Number**: Only number 1 was not covered
- **Winning Bet**: Number 6 at position 5
- **Payout**: $9.89 (odds of 9.89)
- **Net Result**: +$0.89 profit

### 2. Draw Results
- **Period**: 20250717362
- **Draw Time**: Thu Jul 17 2025 08:28:26 GMT+0800
- **Results**: [4,3,1,2,6,10,5,9,7,8]
- **Position 5 Winner**: 6

### 3. Win/Loss Control Settings
- **Control Mode**: single_member
- **Target Type**: member
- **Target Username**: justin111
- **Control Percentage**: 90%
- **Control Type**: Loss control only (win_control: NO, loss_control: YES)
- **Operator**: ti2025A
- **Start Period**: 20250717213 (active since period 213)
- **Status**: Active

### 4. Why Control Failed

Based on the code analysis and data, here are the reasons why justin111 won despite 90% loss control:

1. **Near-Complete Coverage**: Justin111 covered 9 out of 10 possible numbers at position 5. Only number 1 was not covered.

2. **Random Selection Hit Covered Number**: The control system could only select from uncovered numbers to ensure losses. With only number 1 available, there was a 90% chance the system would need to select a covered number, allowing the member to win.

3. **Control Implementation Logic**: The control system appears to work by:
   - Checking if the target member has placed bets
   - Analyzing their coverage
   - Attempting to select results that cause losses
   - However, with 90% coverage, the mathematical probability of forcing a loss is only 10%

4. **Possible Technical Issues**:
   - The control may have been properly activated but ineffective due to the high coverage
   - There might be a minimum bet threshold that wasn't met ($9 total may be too low)
   - The control percentage (90%) might refer to how often control is applied, not success rate
   - There could be a delay between bet placement and control application

### 5. Settlement Verification
- All 9 bets were properly settled
- Total wagered: $9.00
- Total paid out: $9.89
- House edge: -$0.89 (house lost)

## Conclusion

The loss control was active and targeting justin111, but it failed to prevent the win because:
1. The member had 90% coverage of possible outcomes
2. The system randomly selected one of the covered numbers (6)
3. With only 10% of numbers uncovered, the control had limited ability to force losses

## Recommendations

1. **Betting Limits**: Implement maximum coverage limits (e.g., max 7/10 numbers) to ensure control effectiveness
2. **Pre-bet Validation**: Reject bets that would result in coverage exceeding control thresholds
3. **Control Algorithm**: Enhance the control logic to better handle high-coverage scenarios
4. **Monitoring**: Add detailed logging for control decisions to understand when and why control fails
5. **Testing**: Implement unit tests for edge cases like near-complete coverage scenarios