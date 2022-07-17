set -e

docker build -t hgls-stats-local .

docker rm -f hgls-stats-test
docker run -d --name hgls-stats-test \
  -p 127.0.0.1:8039:8039 \
  -p 127.0.0.1:3939:3939 \
hgls-stats-local

docker image prune -f

docker logs -f hgls-stats-test