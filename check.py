import urllib.request, json
url = "https://large-tetra-96073.upstash.io/get/snapshot:index"
token = input("Paste your Upstash token: ")
req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
resp = urllib.request.urlopen(req)
print(json.loads(resp.read()))
