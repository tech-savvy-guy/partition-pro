# import os
# import subprocess
# import time
# import matplotlib
# matplotlib.use('Agg')  # Use the non-GUI backend before importing pyplot
# import matplotlib.pyplot as plt
# import datetime
# import numpy as np
# from docxtpl import DocxTemplate, InlineImage
# from jinja2 import Environment, BaseLoader
# from io import BytesIO
# import tempfile
# from django.conf import settings
# from dateutil import parser
# import html
# from datetime import timedelta
#
# def to_ddmmyyyy(value):
#     try:
#         return parser.parse(value).strftime("%d/%m/%Y")
#     except Exception:
#         return ""
#
# def generate_gauge_chart(value, filename):
#     fig, ax = plt.subplots(figsize=(2, 1), subplot_kw={'projection': 'polar'})
#
#     # Configure polar plot for a gauge that starts at bottom and goes counter-clockwise
#     ax.set_theta_offset(0)  # Start from bottom
#     ax.set_theta_direction(1)  # Go counter-clockwise
#
#     # Limit the plot to a half-circle (semi-circle)
#     ax.set_thetamin(0)
#     ax.set_thetamax(180)
#
#     # Hide grid and axes
#     ax.set_frame_on(False)
#     ax.set_yticklabels([])
#     ax.set_xticklabels([])
#     ax.set_thetagrids([])
#     ax.set_rgrids([])
#
#     # Define the gauge sections (reversed order for correct appearance)
#     sections = [
#         (0, 60, '#e86153'),  # High (right side)
#         (60, 120, '#ffc83d'),  # Medium (middle)
#         (120, 180, '#76df31')  # Low (left side)
#     ]
#
#     for start, end, color in sections:
#         ax.barh(1, np.radians(end - start), left=np.radians(start), height=0.5, color=color)
#
#     # Draw needle - convert percentage to angle
#     # 0% = 180 degrees, 100% = 0 degrees
#     needle_angle = np.radians(180 - (value * 180 / 100))
#     ax.plot([needle_angle, needle_angle], [0, 1], color='black', linewidth=2)
#     # Determine text based on value
#     if value <= 33:
#         text_val = "Low"
#     elif value <= 66:
#         text_val = "Medium"
#     else:
#         text_val = "High"
#     ax.text(0, 0.3, text_val, ha='center', va='center', fontsize=5, fontweight='bold')
#     # Save image
#     plt.savefig(filename, bbox_inches='tight', transparent=True)
#     plt.close()
#
# def assign_risk_level(rating_val):
#     if rating_val <= 33:
#         return "Low"
#     elif rating_val <= 70:
#         return "Medium"
#     else:
#         return "High"
#
# def get_director_data_by_din(din,data):
#     # Find the director using DIN from the directors list
#     director_data = next(
#         (director for director in data["management_structure"]["directors"] if director["directorProfile"]["din"] == din), None
#     )
#
#     if director_data:
#         # Initialize an empty list to store merged company details
#         merged_companies = []
#
#         # Merge current companies
#         for current_company in director_data.get("directorCurrentCompanies", []):
#             merged_companies.append({
#                 "companyName": current_company["company"].get("companyName", "--"),
#                 "companyType": "Current Company",
#                 "designation": current_company.get("designation", "--"),
#                 "appointmentOriginalDate":current_company.get("appointmentOriginalDate", "--"),
#                 "appointmentCurrentDesignationDate": current_company.get("appointmentCurrentDesignationDate", "--"),
#                 "dateCessation": "--"  # Current companies don't have cessation date, so set to "--"
#             })
#
#         # Merge past companies
#         for past_company in director_data.get("directorPastCompanies", []):
#             merged_companies.append({
#                 "companyName": past_company["company"].get("companyName", "--"),
#                 "companyType": "Past Company",
#                 "designation": past_company.get("designation", "--"),
#                 "appointmentOriginalDate": past_company.get("appointmentOriginalDate", "--"),
#                 "appointmentCurrentDesignationDate": past_company.get("appointmentCurrentDesignationDate", "--"),
#                 "dateCessation": past_company.get("dateCessation", "--")  # Use the cessation date from past companies
#             })
#
#         return merged_companies
#     return None
#
# def safe_remove(filepath, retries=5, delay=0.5):
#     for i in range(retries):
#         try:
#             os.remove(filepath)
#             return
#         except PermissionError:
#             time.sleep(delay)
#     print(f"Warning: Could not delete {filepath} after {retries} attempts.")
#
# def escape_json(data):
#     """
#     Recursively escape special characters in JSON-like data.
#     Replaces &, <, >, ", ' with HTML/XML entities.
#     """
#     if isinstance(data, dict):
#         return {k: escape_json(v) for k, v in data.items()}
#     elif isinstance(data, list):
#         return [escape_json(item) for item in data]
#     elif isinstance(data, str):
#         # html.escape escapes &, <, > and optionally quotes
#         return html.escape(data, quote=True)
#     else:
#         # for numbers, bool, None, etc.
#         return data
#
# def generate_doc(data):
#     try:
#         jinja_env = Environment(
#                                     autoescape=False
#
#                                 )
#         jinja_env.filters['to_ddmmyyyy'] = to_ddmmyyyy
#         folder_path = 'templates'
#         found = any(
#             filename.endswith(data['user_input']['client_id']+'.docx')
#             for filename in os.listdir(folder_path)
#             if os.path.isfile(os.path.join(folder_path, filename))
#         )
#         if found:
#             template_path=f"templates/Prudence_DownloadReport_jinjatemp_{data['user_input']['client_id']}.docx"
#         else:
#             template_path="templates/Prudence_DownloadReport_jinjatemp.docx"
#         doc = DocxTemplate(template_path)
#         data=generate_charts(data,doc)
#
#
#         data = escape_json(data)
#
#         doc.render(data, jinja_env=jinja_env, autoescape=False)
#
#         if data['user_input']['report_format'] == "pdf":
#             # Ensure temp directory exists
#             temp_dir = os.path.abspath("./templates/temp")
#             os.makedirs(temp_dir, exist_ok=True)
#             # Create temp .docx file path
#             fd, docx_path = tempfile.mkstemp(suffix=".docx", dir=temp_dir)
#             os.close(fd)  # Close file descriptor immediately
#             doc.save(docx_path)  # Save the DOCX file
#
#             try:
#                 # Define expected PDF path (LibreOffice will write it here)
#                 pdf_path = os.path.splitext(docx_path)[0] + ".pdf"
#
#                 # Run LibreOffice CLI to convert DOCX to PDF
#                 subprocess.run([
#                     settings.LIBREOFFICE_PATH,
#                     "--headless",
#                     '--nologo',
#                     '--nofirststartwizard',
#                     "--convert-to", "pdf:writer_pdf_Export",
#                     "--outdir", temp_dir,
#                     docx_path
#                 ], check=True)
#
#                 # Read the resulting PDF
#                 with open(pdf_path, "rb") as pdf_file:
#                     response = pdf_file.read()
#                     content_type = "application/pdf"
#                     content_disposition = 'attachment; filename="custom_report.pdf"'
#
#                 # Optionally clean up temp files
#                 safe_remove(docx_path)
#                 safe_remove(pdf_path)
#                 # Clean up leftover soffice processes (Linux/Windows-safe)
#                 subprocess.call('taskkill /F /IM soffice.bin',shell=False)
#
#                 return response, content_type, content_disposition
#
#
#             except subprocess.CalledProcessError as e:
#                 subprocess.call('taskkill /F /IM soffice.bin',shell=False)
#                 print(f"LibreOffice conversion failed: {str(e)}")
#                 return None
#
#         else:
#             # DOCX path (return without saving to disk)
#             buffer = BytesIO()
#             doc.save(buffer)
#             buffer.seek(0)
#
#             response = buffer
#             content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
#             content_disposition = f'attachment; filename="custom_report.docx"'
#             # response, content_type, content_disposition=generate_clean_docx_from_buffer(buffer)
#             return response, content_type, content_disposition
#     except Exception as ex:
#         print(ex)
#         subprocess.call('taskkill /F /IM soffice.bin', shell=False)
#         return None
#
# def generate_auto_report(data, user_input):
#     data['user_input'] = user_input
#     data=process_data(data)
#     # table_data = [
#     #     ["Year", "Revenue", "Profit"],
#     #     [2020, 1000000, 200000],
#     #     [2021, 1500000, 250000],
#     #     [2022, 1800000, 300000]
#     # ]
#     # data['headers'] = table_data[0]
#     # data['rows'] = table_data[1:]
#
#     return generate_doc(data)
#
# def process_data(data):
#     financials_value=[]
#     result = []
#     try:
#         # print(data)
#         if data["company_overview"] is not None:
#
#             if data["management_structure"]:
#                 for signatory in data["management_structure"]["signatories"]:
#                     din = signatory["directorProfile"]["din"]
#                     director_companies = get_director_data_by_din(din,data)
#
#                     if director_companies:
#                         result.append({
#                             "directorName": signatory["directorProfile"]["directorName"],
#                             "companies": director_companies
#                         })
#             else:
#                 data["management_structure"]={}
#
#             data["management_structure"]["new"] = result
#             if 'Financials' in data['user_input']['customOptions']:
#                 financials_value = data['user_input']['customOptions']['Financials']
#                 if financials_value:
#                     data["finance"]["financial_metrics_transformed"] = transform_financial_data(
#                         data["finance"]["financial_metrics"]['data'], data["finance"]["financial_metrics"]['columnNames'],'metrics')
#                     data["finance"]["financial_ratios_transformed"] = transform_financial_data(
#                         data["finance"]["financial_ratios"]['data'], data["finance"]["financial_ratios"]['columnNames'],'ratios')
#                     data['finance']['credit_ratings']=filter_data_on_2_years(data['finance']['credit_ratings'],'ratingDate','finance')
#
#                 data["finance"]["financial_metrics_transformed"] = round_floats(data["finance"]["financial_metrics_transformed"])
#                 data["finance"]["financial_ratios_transformed"] = round_floats(data["finance"]["financial_ratios_transformed"])
#                 data["finance"]["credit_ratings"] = round_floats(data["finance"]["credit_ratings"])
#
#
#             if data['shareholdings'] is None:
#                 data['shareholdings'] = {}
#             else:
#                 data['shareholdings']['annual-returns'] = round_floats(data['shareholdings']['annual-returns'])
#
#                 data['shareholdings']['annual_ret'] = data['shareholdings']['annual-returns']
#
#                 if data['shareholdings']['key_shareholders'] == []:
#                     data['shareholdings']['key_shareholders'] = {}
#         if 'Litigations' in data['user_input']['customOptions']:
#             litigation_value = data['user_input']['customOptions']['Litigations']
#             if litigation_value:
#                 # data['litigation']['litigation_records'] = filter_data_on_2_years(data['litigation']['litigation_records'], 'appealNumber','litigation')
#                 data['litigation']['litigation_records'] = data['litigation']['litigation_records']
#         if data['sanction'] is None:
#             data['sanction']={"company_details":{},"individual_details":[]}
#
#
#
#
#         if data['risk_ratings'] == {}:
#             data['risk_ratings'] = {"media": 0,
#                                     "media_signals": [{"name": "Financial Risk", "rating": "", "rating_val": 0, "count": 0},
#                                                       {"name": "Operational Risks", "rating": "", "rating_val": 0,
#                                                        "count": 0},
#                                                       {"name": "Regulatory and Compliance", "rating": "", "rating_val": 0,
#                                                        "count": 0},
#                                                       {"name": "Legal Concerns", "rating": "", "rating_val": 0, "count": 0},
#                                                       {"name": "Cyber Security", "rating": "", "rating_val": 0, "count": 0},
#                                                       {"name": "Bankruptcy", "rating": "", "rating_val": 0, "count": 0},
#                                                       {"name": "Management Risks", "rating": "", "rating_val": 0,
#                                                        "count": 0},
#                                                       {"name": "ESG Risks", "rating": "", "rating_val": 0, "count": 0},
#                                                       {"name": "Human Rights Concerns", "rating": "", "rating_val": 0,
#                                                        "count": 0},
#                                                       {"name": "Bribery and Corruption", "rating": "", "rating_val": 0, "count": 0}],
#                                     "litigation": 0,
#                                     "litigation_signals": [{"name": "Civil Pending", "rating": "", "rating_val": 0, "count": 0},
#                                                            {"name": "Civil Disposed", "rating": "", "rating_val": 0, "count": 0},
#                                                            {"name": "Criminal Pending", "rating": "", "rating_val": 0, "count": 0},
#                                                            {"name": "Criminal Disposed", "rating": "", "rating_val": 0, "count": 0},
#                                                            {"name": "Others", "rating": "", "rating_val": 0, "count": 0}],
#                                     "financials": 80, "sanctions": 50, "overall": 32.5, "financials_summary": ""}
#
#
#         for item in data['risk_ratings']['media_signals']:
#             for signal_bucket in data['media']['signal_buckets']:
#                 if signal_bucket["category"] == item["name"]:
#                     item["count"] = signal_bucket["count"]
#                     break
#                 else:
#                     item["count"] = 0
#
#         for item in data['risk_ratings']['litigation_signals']:
#             for case_bucket in data['litigation']['case_buckets']:
#                 if case_bucket["case_type"] == item["name"]:
#                     item["count"] = case_bucket["count"]
#                     break
#                 else:
#                     item["count"] = 0
#         print(data["risk_ratings"])
#
#         # Get today's date
#         today = datetime.datetime.today()
#         # Calculate the date 3 years ago (approximate by subtracting 3*365 days)
#         three_years_ago = today - timedelta(days=3 * 365)
#         filtered_media=[]
#         total_media_art=len(data['media']['mediaRecords'])
#         filtered_media = [
#                 item for item in data['media']['mediaRecords']
#                 if datetime.datetime.strptime(item["publishedDate"], "%Y-%m-%d") >= three_years_ago
#             ]
#         data['media']['mediaRecords']=filtered_media
#         filtered_media_art = len(data['media']['mediaRecords'])
#         data['media']['total_rec']=total_media_art
#         data['media']['filt_total_rec']=filtered_media_art
#         return data
#     except Exception as ex:
#         return data
#
# def transform_financial_data(data,column_names,type):
#     result=[]
#     for entry in data:
#         financial_entry={}
#         i=0
#         for colName in column_names:
#             if colName=='Date':
#                 financial_entry[colName] = datetime.datetime.strptime(entry[i], "%Y-%m-%d %H:%M:%S").year
#             else:
#                 if type=='ratios':
#                     financial_entry[colName] = safe_round(entry[i])
#                 else:
#                     financial_entry[colName]=entry[i]
#             i+=1
#         result.append(financial_entry)
#     return result
#
# def safe_round(value, digits=2):
#     try:
#         if value is None:
#             return '--'
#         return round(float(value), digits)
#     except (ValueError, TypeError):
#         return '--'
#
# def round_floats(obj):
#     if isinstance(obj, dict):
#         new_obj = {}
#         for k, v in obj.items():
#             if isinstance(v, float):
#                 # Round to 2 decimal places
#                 new_obj[k] = round(v, 2)
#             else:
#                 new_obj[k] = round_floats(v)
#         return new_obj
#     elif isinstance(obj, list):
#         return [round_floats(item) for item in obj]
#     else:
#         return obj
#
# def generate_charts(data,doc):
#     # Generate all charts first and collect images along with their keys
#     imageObjs = []
#     current_directory = os.getcwd()
#     keys_to_check = ['media', 'litigation', 'financials', 'sanctions', 'overall']
#
#     if 'risk_ratings' in data:
#         for key in keys_to_check:
#             if key in data['risk_ratings']:
#                 value = data['risk_ratings'][key]
#                 chart_filename = f'gauge_chart_{key}.png'
#
#                 # Generate the gauge chart for the current key
#                 generate_gauge_chart(value, chart_filename)
#
#                 # Collect the image along with its key
#                 image_path = os.path.join(current_directory, chart_filename)
#                 if os.path.exists(image_path):  # Check if the image file exists
#                     imgObj = InlineImage(doc, image_path)
#                     imageObjs.append((key, imgObj))  # Store both key and InlineImage object
#
#     data['images'] = imageObjs
#     current_date = datetime.datetime.now()
#     month_year = current_date.strftime("%B %Y")
#     data["Monthyear"] = month_year
#     toc = []
#     toc_index = {}
#     i = 1
#     for key, value in data['user_input']['customOptions'].items():
#         if value:
#             toc.append({"section": key, "val_index": i})
#             toc_index[key.replace(' ', '')] = i
#             i += 1
#     data['toc'] = toc
#     data['toc_index'] = toc_index
#     return data
#
# def filter_data_on_2_years(data,key,key_type):
#     if key_type=='finance':
#         # Current date
#         now = datetime.datetime.now()
#
#         # Cutoff date: 2 years ago
#         cutoff_date = now.replace(year=now.year - 2)
#
#         # Filter data for last 2 years
#         filtered_data = []
#         for item in data:
#             try:
#                 created_date = parser.parse(item[key])
#                 if created_date >= cutoff_date:
#                     filtered_data.append(item)
#             except (ValueError, TypeError):
#                 # Skip if date can't be parsed
#                 pass
#
#     else:
#         # Get current year
#         current_year = datetime.datetime.now().year
#
#         # Define year cutoff
#         min_year = current_year - 2
#
#         # Filter JSON
#         filtered_data = []
#         for item in data:
#             try:
#                 # Extract year from the end of the string
#                 parts = item[key].split("/")
#                 year = int(parts[-1])
#                 if min_year <= year <= current_year:
#                     filtered_data.append(item)
#             except (ValueError, IndexError, KeyError):
#                 # Skip if extraction fails or year isn't valid
#                 continue
#     return filtered_data
