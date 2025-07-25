#!/bin/bash

echo "====================================="
echo "Agent Chain API Test Script"
echo "====================================="
echo "Test Time: $(date)"
echo ""

# Test users
users=("justin111" "lala222" "ti2025" "ti2025a")

# Test local API
echo "Testing Local API (http://localhost:5001)"
echo "====================================="

for user in "${users[@]}"; do
    echo ""
    echo "Testing user: $user"
    echo "-----------------------------------"
    
    # Make the API call
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "http://localhost:5001/api/agent/member-agent-chain?username=$user")
    
    # Extract HTTP status
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    # Extract JSON response (everything before HTTP_STATUS)
    json_response=$(echo "$response" | sed -n '/HTTP_STATUS/!p')
    
    echo "HTTP Status: $http_status"
    
    if [ "$http_status" = "200" ]; then
        echo "Response:"
        echo "$json_response" | python -m json.tool 2>/dev/null || echo "$json_response"
        
        # Extract and display rebate_percentage values
        echo ""
        echo "Rebate percentages found:"
        echo "$json_response" | grep -o '"rebate_percentage":[^,]*' | sed 's/"rebate_percentage":/  - /'
    else
        echo "Error: Failed to get response"
        echo "$json_response"
    fi
    
    echo ""
done

echo ""
echo "====================================="
echo "Testing Production API (https://bet-agent.onrender.com)"
echo "====================================="

for user in "${users[@]}"; do
    echo ""
    echo "Testing user: $user"
    echo "-----------------------------------"
    
    # Make the API call
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "https://bet-agent.onrender.com/api/agent/member-agent-chain?username=$user")
    
    # Extract HTTP status
    http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    # Extract JSON response
    json_response=$(echo "$response" | sed -n '/HTTP_STATUS/!p')
    
    echo "HTTP Status: $http_status"
    
    if [ "$http_status" = "200" ]; then
        echo "Response:"
        echo "$json_response" | python -m json.tool 2>/dev/null || echo "$json_response"
        
        # Extract and display rebate_percentage values
        echo ""
        echo "Rebate percentages found:"
        echo "$json_response" | grep -o '"rebate_percentage":[^,]*' | sed 's/"rebate_percentage":/  - /'
    else
        echo "Error: Failed to get response"
        echo "$json_response"
    fi
    
    echo ""
done

echo "====================================="
echo "Test Complete"
echo "====================================="