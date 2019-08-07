FROM ubuntu:trusty

RUN apt-get update && apt-get -y install ca-certificates curl python-software-properties

WORKDIR /root

COPY package.json package-lock.json /root/

RUN curl -sL https://deb.nodesource.com/setup_8.x | bash - \ 
    && apt-get install -y ca-certificates nodejs \
    && npm install

ARG NODE_ENV
COPY . /root
RUN npm run build

CMD [ "npm", "start" ]
