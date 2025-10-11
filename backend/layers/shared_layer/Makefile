build-SharedLayer:
	mkdir -p "$(ARTIFACTS_DIR)/python"
	cp -r python/shared "$(ARTIFACTS_DIR)/python/"
	[ -e requirements.txt ] && pip3 install -r requirements.txt -t "$(ARTIFACTS_DIR)/python" || true
