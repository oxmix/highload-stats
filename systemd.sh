#!/usr/bin/env bash

exec=`realpath server/server.js`
if [ ! -f $exec ]; then
        echo "Not found path: $exec"
        exit
fi

sudo echo "[Unit]
Description=highload-stats
After=network-online.target

[Service]
Type=simple
ExecStart=$exec
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target" > /etc/systemd/system/hgls.service

sudo chmod 644 /etc/systemd/system/hgls.service

sudo systemctl enable hgls.service
sudo systemctl start hgls.service
sudo systemctl status hgls.service
