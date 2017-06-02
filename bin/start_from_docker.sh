echo "start delpoying..."

# delpoy by pm2-docker
cd /usr/local/gdal-tiff-sentinel-aws/

npm install --registry=http://npmjs.gagogroup.cn

gulp ts

pm2-docker start "dist/app.js" -i 1

echo "end delpoying"