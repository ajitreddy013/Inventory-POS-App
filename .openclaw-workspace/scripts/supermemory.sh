#!/bin/bash
# Supermemory helper for CounterFlow Bot

API_KEY="sm_AghuQ8Z72B5677qdYSn3B5_sFcqgSlFBAWqnNFHwyixDeVSkNCMfPEgpdJQhjbvwaZoAuYCQGdFRBMMfQqVfAxl"
CONTAINER="default"

if [ "$1" = "search" ]; then
  curl -s https://api.supermemory.ai/v3/search \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"q\": \"$2\", \"containerTag\": \"$CONTAINER\"}"
  
elif [ "$1" = "add" ]; then
  curl -s -X POST https://api.supermemory.ai/v3/documents \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"$2\", \"containerTag\": \"$CONTAINER\", \"type\": \"text\"}"
    
elif [ "$1" = "addjson" ]; then
  echo "$2" | curl -s -X POST https://api.supermemory.ai/v3/documents \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d @-

else
  echo "Usage: $0 <search|add|addjson> <query>"
  echo "  search <query>  - Search memories"
  echo "  add <content>   - Add new memory"
  echo "  addjson <json>  - Add memory from JSON"
fi
