from flask import Flask, jsonify, request
import tempfile
import os
from dotenv import load_dotenv

from inference.inference_catboost import inference_catboost

# Загружаем переменные окружения
load_dotenv()

app = Flask(__name__)


@app.route("/ml/catboost", methods=['POST'])
def catboost_inference():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    print("Catboost inference")

    temp = tempfile.NamedTemporaryFile(delete=False, suffix='.edf')
    try:
        file.save(temp.name)
        temp.close()

        times, y_pred, y_pred_proba = inference_catboost(temp.name)

        # Convert numpy arrays to Python lists for JSON serialization
        times_list = times.tolist() # [[start, end]] - [[1, 2], [3, 4], ...]
        y_pred_list = y_pred.tolist() # [class] - [1, 2, ...]
        y_pred_proba_list = y_pred_proba.tolist() # [confidence] - [0.5, 0.3, ...]

        # transform to events
        # {events: [{type: 1, time: {start: 1, end: 2}, confidence: 0.5}]}
        events = []
        for i in range(len(times_list)):
            events.append({
                'type': y_pred_list[i],
                'time': {'start': times_list[i][0], 'end': times_list[i][1]},
                'confidence': y_pred_proba_list[i]
            })

        return jsonify({
            'times': times_list, 
            'y_pred': y_pred_list, 
            'y_pred_proba': y_pred_proba_list,
            'events': events
        })
    finally:
        os.unlink(temp.name)
