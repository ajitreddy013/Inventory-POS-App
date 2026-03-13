const API_KEY = "sm_AghuQ8Z72B5677qdYSn3B5_sFcqgSlFBAWqnNFHwyixDeVSkNCMfPEgpdJQhjbvwaZoAuYCQGdFRBMMfQqVfAxl";
const CONTAINER = "default";

async function search(query) {
  const response = await fetch('https://api.supermemory.ai/v3/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, containerTag: CONTAINER })
  });
  const data = await response.json();
  return data.results || [];
}

async function add(content) {
  const response = await fetch('https://api.supermemory.ai/v3/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content, containerTag: CONTAINER, type: 'text' })
  });
  const data = await response.json();
  return data;
}

// CLI handler
const args = process.argv.slice(2);
if (args[0] === 'search') {
  search(args.slice(1).join(' ')).then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
} else if (args[0] === 'add') {
  add(args.slice(1).join(' ')).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
