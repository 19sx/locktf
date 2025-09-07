import os
import datetime

from cs50 import SQL
from flask import Flask, redirect, render_template, request, session


app = Flask(__name__)



@app.route("/")
def index():
        return render_template("home.html")



