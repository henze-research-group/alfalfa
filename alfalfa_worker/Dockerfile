FROM michaelwetter/ubuntu-1604_jmodelica_trunk

USER root
ENV HOME /home/alfalfa

WORKDIR /alfalfa

RUN apt-get update -y && apt-get install -y \
    ca-certificates curl libglu1 libjpeg8 libfreetype6 libxi6 libdbus-glib-1-2 libfontconfig1 libsm6 gdebi-core python3.5 python3-pip \
    && apt-get install -y git

RUN apt-get update \
    && apt-get install -y software-properties-common \
    && add-apt-repository -y ppa:openjdk-r/ppa \
    && apt-get update -y \
    && apt-get install -y openjdk-8-jdk-headless \
    && update-alternatives --config java \
    && update-alternatives --config javac

RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py \
  && python3.5 get-pip.py

COPY alfalfa_worker/requirements/production.txt /alfalfa/
RUN  python3.5 -m pip install --ignore-installed -r /alfalfa/production.txt
RUN  python -m pip install --ignore-installed -r /alfalfa/production.txt

COPY . /alfalfa
COPY ./deploy/wait-for-it.sh /usr/local/wait-for-it.sh
COPY ./deploy/start_worker.sh start_worker.sh

WORKDIR /alfalfa
RUN pip3 install .

WORKDIR /alfalfa/alfalfa_worker

ENV ROOT_DIR /usr/local
ENV JMODELICA_HOME $ROOT_DIR/JModelica
ENV IPOPT_HOME $ROOT_DIR/Ipopt-3.12.4
ENV SUNDIALS_HOME $JMODELICA_HOME/ThirdParty/Sundials
ENV SEPARATE_PROCESS_JVM /usr/lib/jvm/java-8-openjdk-amd64/
ENV JAVA_HOME /usr/lib/jvm/java-8-openjdk-amd64/
ENV PYTHONPATH $PYTHONPATH:$JMODELICA_HOME/Python:$JMODELICA_HOME/Python/pymodelica

CMD [ "/alfalfa/start_worker.sh" ]

