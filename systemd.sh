#!/usr/bin/env bash

exec=`realpath ./server/index.js`
if [ ! -f $exec ]; then
    echo "Not found path: $exec"
    exit
fi

echo "[Unit]
Description=https://github.com/oxmix/highload-stats
After=network-online.target

[Service]
Type=simple
ExecStart=$exec
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target" | sudo tee /etc/systemd/system/hgls.service > /dev/null

sudo chmod 644 /etc/systemd/system/hgls.service

sudo systemctl daemon-reload
sudo systemctl enable hgls.service
sudo systemctl restart hgls.service
sudo systemctl status hgls.service
