fetch("https://oauth2.googleapis.com/tokeninfo?id_token=test")
  .then(r => r.json())
  .then(d => console.log("OK:", JSON.stringify(d)))
  .catch(e => console.error("ERR:", e.message, String(e.cause)));
