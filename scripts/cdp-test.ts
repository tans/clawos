let res = await fetch('http://127.0.0.1:9222/json/version')
let json = await res.json()
console.log(json)