let res = await fetch('http://172.23.96.1/:9222/json/version')
let json = await res.json()
console.log(json)