FROM mhart/alpine-node:latest

WORKDIR /usr/app
COPY ./ /usr/app

# Install dev dependencies to remove flow types and process files but after that
# only preserve production ones

WORKDIR /usr/app
RUN yarn install && yarn run build 

WORKDIR /usr/app

CMD ["node", "./dist/index.js"]
