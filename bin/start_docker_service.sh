# start docker and run the service bash script to run the service
chmod 777 /home/huteng/www/gdal-tiff-sentinel-aws/bin/start_from_docker.sh

docker run --name redis -d redis

docker run -it --link redis:redis  -v /home/huteng/www/gdal-tiff-sentinel-aws/:/usr/local/gdal-tiff-sentinel-aws/ -v /mountdata/s3-gagobucket/tiles:/mountdata/s3-gagobucket/tiles -v /mountdata/s3-sentinel-2/tiles/:/mountdata/s3-sentinel-2/tiles/ docker.gagogroup.cn:5000/gdal:latest sh /usr/local/gdal-tiff-sentinel-aws/bin/start_from_docker.sh