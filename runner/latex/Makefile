.PHONY:build
build:
	docker build -t latex .

.PHONY:run
run:
	docker run --rm \
		-v $(realpath ..)/latex.priv:/root/.ssh/id_rsa \
		-v $(realpath ../..)/build:/build \
		latex \
		mischnic/VWA ee1641c4fc6b8a5d7e3d93a3b27cc2ad2aa82a41 main clean