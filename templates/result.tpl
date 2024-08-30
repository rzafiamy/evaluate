<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Evaluation Report</title>
    <style>
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table, th, td {
            border: 1px solid black;
        }
        th, td {
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>
    <h2>Evaluation Report</h2>
    <table>
        <thead>
            <tr>
                <th>Test</th>
                <th>Prompt</th>
                <th>Category</th>
                <th>Expected</th>
                <th>Response</th>
                <th>Similarity</th>
                <th>Success</th>
            </tr>
        </thead>
        <tbody>
            {% for result in results %}
            <tr>
                <td>{{ result[0] }}</td>
                <td>{{ result[1] }}</td>
                <td>{{ result[2] }}</td>
                <td>{{ result[3] }}</td>
                <td>{{ result[4] }}</td>
                <td>{{ result[5] }}</td>
                <td>{{ result[6] }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</body>
</html>
