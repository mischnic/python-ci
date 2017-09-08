import React from "react";
import {getJWT, logout} from "./auth.js";

const makeCancelable = (promise, errorFree = true) => {
	let hasCanceled_ = false;

	const wrappedPromise = new Promise((resolve, reject) => {
		promise.then(
			val => hasCanceled_ ? (errorFree ? resolve() : reject({isCanceled: true})) : resolve(val),
			error => hasCanceled_ ? (errorFree ? reject() : reject({isCanceled: true})) : reject(error)
		);
	});

	return {
		promise: wrappedPromise,
		cancel() {
			hasCanceled_ = true;
		},
	};
};

function pad(n, width, z) {
	z = z || "0";
	n = n + "";
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function formatDate(date){
	return pad(date.getDate(), 2)+"."+pad(date.getMonth()+1, 2)+"."+date.getFullYear()+" - " +
		pad(date.getHours(), 2)+":"+pad(date.getMinutes(), 2);
}

function formatTime(sec){
	if(!sec){
		return null;
	} if(sec < 60){
		return sec.toFixed(1)+" seconds";
	} else {
		return Math.floor(sec/60)+":"+Math.floor(sec%60)+(Math.floor(sec/60) === 1 ? " minute" : " minutes");
	}
}

function humanDate(date){
	let diff = (new Date() - date);
	let diffMinutes = Math.floor(diff / 1000 / 60);
	let diffHours = Math.floor(diff / 1000 / 60 / 60);

	if(diffMinutes > 60){
		if(diffHours > 24){
			return formatDate(date);
		} else {
			return `${diffHours} hours ago`;
		}
	} else {
		return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
	}
}

const api = (comp, url, settings={}, type = "json") => {
	let i = {
		...settings,
		headers: {"Authorization": "Bearer "+getJWT(), Accept: "application/json", ...settings.headers, },
	};

	if(i.body && !i.method){
		i.method = "POST";
	}

	if(typeof settings.body === "object") {
		i.headers = {...i.headers, "Content-Type": "application/json"};
		i.body = JSON.stringify(i.body);
	}

	switch(type){
		case "text":
			i.headers.Accept = "text/plain";
			type = (res) => res.text();
			break;
		default:
		case "json":
			i.headers.Accept = "application/json";
			type = (res) => res.json();
			break;
	}

	return fetch(url, i)
	.then(function(res) {
		if(res.ok) {
			return type(res);
		} else return Promise.reject(res);
	}).catch((res)=>{
		if(res.status === 401){
			if(comp){
				logout();
				comp.props.history.push("/");
			} else {
				return Promise.reject(res);
			}
		}
	});
};

const Loading = () =>
	<div style={{display:"flex",justifyContent:"center",alignItems:"center", opacity: "0.07", fontSmoothing: "none"}}>
		<i className="fa fa-cog fa-4x fa-spin"/>
	</div>;


// fetch("/api/files/rename", {
//     method: "POST",
// 	headers: {Authorization: "Bearer "+localStorage.getItem("jwt"), "Content-Type": "application/json"},
//     body: JSON.stringify({"user": "me"}),
// }).then((r)=>r.json()).then(console.log)


export {api, formatDate, formatTime, humanDate, pad, makeCancelable, Loading};