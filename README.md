# aws-tiff-parser

# OVERVIEW

该工程为image-browser项目的附属工程，为image-browser提供切片服务, 生产image-browser需要的tiff格式图片

工程需要挂载AWS s3上的sentinel-2的bucket（http://sentinel-pds.s3-website.eu-central-1.amazonaws.com/#AccessingData）

读取原始的jp2图片，生产成tiff格式图片，保存到本地或者bucket上

该工程部署在AWS ec2 上

# 构建

该工程采用nodejs开发，Typescript编写

1. 安装 node.js 6.11.0 以及 npm，Typescript
2. 安装redis
3. 安装gdal

或者用打包好环境的docker镜像
docker pull huteng/cent7:gdal 

# 配置环境

## NODE_ENV
`NODE_ENV` 在本地需要设置为`development`，在生产服务器为`production`

# LINT

`sh ./bin/tslint.sh`

# GULP

1. `gulp ts` 将会把 TypeScript 编译成 JavaScript 到 `./dist` 文件夹.
2. `gulp server` 将启动 `./dist/app.js`.

# 部署服务器

工程采用Docker方式部署

镜像采用了基于centos7，预先安装了nodejs, npm, pm2 等

可以通过
docker pull huteng/cent7:gdal 
获取镜像

redis也采用了镜像方式启动
docker pull redis

启动时将工程挂载进镜像部署

可以运行bin/start_docker_service.sh脚本

docker run -it -p 3000:3000 --link redis:redis  -v /home/huteng/www/gdal-tiff-sentinel-aws/:/usr/local/gdal-tiff-sentinel-aws/ -v /mountdata/s3-gagobucket/tiles:/mountdata/s3-gagobucket/tiles -v /mountdata/s3-sentinel-2/tiles/:/mountdata/s3-sentinel-2/tiles/ huteng/cent7:node sh /usr/local/gdal-tiff-sentinel-aws/bin/start_from_docker.sh

