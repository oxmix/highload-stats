#!/usr/bin/env bash
sudo killall highLoad-stats
sudo ./server.js > stdout.log 2>stderr.log &