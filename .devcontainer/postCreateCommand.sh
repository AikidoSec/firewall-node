#!/bin/bash

# Update
sudo apt update -y && sudo apt upgrade -y
rustup update
source /usr/local/share/nvm/nvm.sh
nvm install --lts
nvm use --lts
npm update -g

# Install WASM pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Install k6
## k6 installation -- arm machines
if [ "$(uname -m)" = "aarch64" ]; then
	K6_TAR_LINK=https://github.com/grafana/k6/releases/download/v0.58.0/k6-v0.58.0-linux-arm64.tar.gz
	curl -OL $K6_TAR_LINK
	tar -xzf k6-v0.58.0-linux-arm64.tar.gz
	sudo mv k6-v0.58.0-linux-arm64/k6 /usr/local/bin/k6
	rm -rf k6-v0.58.0-linux-arm64*
else ## k6 installation -- other architectures
	sudo gpg -k
	sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
	echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
	sudo apt-get update -y
	sudo apt-get install k6 -y
fi

# Install wrk, sqlite3
sudo apt install wrk sqlite3 -y

# Install npm packages, build and run containers
npm i
npm run build
npm run containers