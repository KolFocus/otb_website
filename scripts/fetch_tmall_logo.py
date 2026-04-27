import urllib.request
import urllib.parse
import re
import json

def fetch_logo(keyword):
    url = "https://s.taobao.com/search?q=" + urllib.parse.quote(keyword)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    try:
        html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8', errors='ignore')
        # match img.alicdn.com
        matches = re.findall(r'//img\.alicdn\.com/[a-zA-Z0-9_/\.\-]+', html)
        return matches[:3]
    except Exception as e:
        return str(e)

print("ShopLinq:", fetch_logo("shoplinq西有奥莱旗舰店"))
print("星期六:", fetch_logo("星期六西芽专卖店"))
