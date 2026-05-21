import os
import urllib.request

libs = {
    "tabler.min.css": "https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/css/tabler.min.css",
    "jquery-3.7.1.min.js": "https://code.jquery.com/jquery-3.7.1.min.js",
    "bootstrap.bundle.min.js": "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js",
    "tabler.min.js": "https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/js/tabler.min.js",
    "chart.umd.min.js": "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
    "chartjs-plugin-datalabels.min.js": "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"
}

os.makedirs("assets/libs", exist_ok=True)

for name, url in libs.items():
    path = os.path.join("assets/libs", name)
    print(f"Downloading {url} to {path}")
    urllib.request.urlretrieve(url, path)
