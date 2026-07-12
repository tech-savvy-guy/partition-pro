import os
import logging
from logging import FileHandler, Formatter
from datetime import datetime


def get_file_logger(date=datetime.now()):
    LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
    LOG_FOLDER = ".\\Security_logs"
    LOG_LEVEL = logging.INFO
    file_name = date.strftime('%d-%m-%Y')
    # file_folder_path = os.path.join(LOG_FOLDER, date.strftime('%d-%m-%Y'))
    if not os.path.exists(LOG_FOLDER):
        os.makedirs(LOG_FOLDER)
    file_path = os.path.join(LOG_FOLDER, '{}.log'.format(file_name))
    util_logger = logging.getLogger(file_name)
    util_logger.setLevel(LOG_LEVEL)
    util_logger_file_handler = FileHandler(file_path)
    util_logger_file_handler.setLevel(LOG_LEVEL)
    util_logger_file_handler.setFormatter(Formatter(LOG_FORMAT))
    if util_logger.hasHandlers():
        util_logger.handlers.clear()
    util_logger.addHandler(util_logger_file_handler)
    return util_logger