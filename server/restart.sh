#!/usr/bin/env bash
sudo killall highload-stats
sudo ./server.js > stdout.log 2>stderr.log &