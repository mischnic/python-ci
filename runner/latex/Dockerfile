FROM alpine-glibc
LABEL maintainer="Niklas Mischkulnig"

RUN apk update &&\
	apk add --no-cache perl wget xz tar coreutils gnupg \
					   git libnsl biber util-linux openssh-client

RUN mkdir /tmp/install-tl-unx
WORKDIR /tmp/install-tl-unx

RUN wget http://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz
RUN mkdir install-tl && tar xzf install-tl-unx.tar.gz -C install-tl --strip-components=1

COPY texlive.profile install-tl/
RUN install-tl/install-tl -profile install-tl/texlive.profile

ENV PATH /usr/local/texlive/2017/bin/x86_64-linux/:$PATH

RUN tlmgr install latexmk xstring ulem framed enumitem todonotes units footmisc csquotes wrapfig stackengine listofitems environ trimspaces

WORKDIR /root
COPY TeXcount_3_1 TeXcount
COPY run.sh .

ENV CLICOLOR 1
ENV TERM xterm-256color

ENTRYPOINT ["/root/run.sh"]
