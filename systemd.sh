#!/usr/bin/env bash

sudo echo '[Unit]
Description=highload-stats

[Service]
Type=simple
ExecStart=/root/highload-stats/server/server.js

[Install]
WantedBy=multi-user.target' > /etc/systemd/system/hgls.service

sudo chmod 644 /etc/systemd/system/hgls.service

sudo systemctl enable hgls.service
sudo systemctl start hgls.service
sudo systemctl status hgls.service
