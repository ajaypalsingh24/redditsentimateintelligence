import requests


def send_webhook_alert(webhook_url: str, brand_name: str, title: str, url: str, severity: int) -> bool:
    if not webhook_url:
        return False

    payload = {
        "text": f"Negative Reddit mention found for {brand_name}\nSeverity: {severity}/100\n{title}\n{url}"
    }
    response = requests.post(webhook_url, json=payload, timeout=20)
    response.raise_for_status()
    return True
