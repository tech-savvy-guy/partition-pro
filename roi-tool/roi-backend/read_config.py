import os
import sys
import json

PROJECT_PATH = os.path.dirname(os.path.realpath(__file__))

if getattr(sys, 'frozen', False):
    PROJECT_PATH = os.path.dirname(sys.executable)
elif __file__:
    PROJECT_PATH = os.path.dirname(__file__)
# PROJECT_PATH=PROJECT_PATH.rsplit('\\', 1)[0]
CONFIGS_PATH = os.path.join(PROJECT_PATH, "config1", "config.txt")
print(CONFIGS_PATH)
def read_config_file(path):
    try:
        with open(path, "r") as json_file:
            json_data = json.load(json_file)
            return json_data
    except FileNotFoundError as e:
        print("Config File Not Found Please add config1 file in configs folder")


CONFIG = read_config_file(CONFIGS_PATH)
