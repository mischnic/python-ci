import React from "react";
import {getJWT, logout} from "./auth.js";

const withFetcher = (Component) => (
	class Fetcher extends React.Component {
		constructor(props){
			super(props);
			this.requests = [];
			this.requests.remove = function(v){
				v.cancel();
				const i = this.indexOf(v);
				if(i > -1){
					this.splice(i, 1);
				}
			};
		}

		componentWillUnmount(){
			this.requests.map((v)=>v.cancel());
		}

		fetch(...a){
			const req = makeCancelable(
				api(Component, ...a)
					// .then((v)=>{
					// 	req.cancel();
					// 	this.requests.splice(this.requests.indexOf(req), 1);
					// 	return v;
					// }, (v)=>{
					// 	req.cancel();
					// 	this.requests.splice(this.requests.indexOf(req), 1);
					// 	return v;
					// })
			);
			this.requests.push(req);
			return req.promise;
		}

		render(){
			const {...props} = this.props;
			return <Component {...props} fetch={(...a)=>this.fetch(...a)}/>;
		}
	}
)


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
		return Math.floor(sec/60)+":"+pad(Math.floor(sec%60), 2) + (Math.floor(sec/60) === 1 ? " minute" : " minutes");
	}
}

function humanDate(date){
	let diff = (new Date() - date);
	let diffMinutes = Math.round(diff / 1000 / 60);
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
	return fetch(url, { headers: {"Authorization": "Bearer "+getJWT(), method: (settings.body ? "POST" : "GET"),  ...settings.headers, } })
		.then(function(res) {
			if(res.ok) {
				return res;
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

// const api = (comp, url, settings={}, type = "json") => {
// 	let i = {
// 		...settings,
// 		headers: {"Authorization": "Bearer "+getJWT(), Accept: "application/json", ...settings.headers, },
// 	};

// 	if(i.body && !i.method){
// 		i.method = "POST";
// 	}

// 	if(typeof settings.body === "object") {
// 		i.headers = {...i.headers, "Content-Type": "application/json"};
// 		i.body = JSON.stringify(i.body);
// 	}

// 	switch(type){
// 		case "text":
// 			i.headers.Accept = "text/plain";
// 			type = (res) => res.text();
// 			break;
// 		default:
// 		case "json":
// 			i.headers.Accept = "application/json";
// 			type = (res) => res.json();
// 			break;
// 	}

// 	return fetch(url, i)
// 	.then(function(res) {
// 		if(res.ok) {
// 			return type(res);
// 		} else return Promise.reject(res);
// 	}).catch((res)=>{
// 		if(res.status === 401){
// 			if(comp){
// 				logout();
// 				comp.props.history.push("/");
// 			} else {
// 				return Promise.reject(res);
// 			}
// 		}
// 	});
// };

const Loading = (props) =>
	<div style={{display:"flex",justifyContent:"center",alignItems:"center", opacity: props.opacity ? props.opacity : "0.07", fontSmoothing: "none"}}>
		<i className="fa fa-cog fa-4x fa-spin"/>
	</div>;


// fetch("/api/files/rename", {
//     method: "POST",
// 	headers: {Authorization: "Bearer "+localStorage.getItem("jwt"), "Content-Type": "application/json"},
//     body: JSON.stringify({"user": "me"}),
// }).then((r)=>r.json()).then(console.log)


export {api, formatDate, formatTime, humanDate, pad, makeCancelable, Loading, withFetcher};