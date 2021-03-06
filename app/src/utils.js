import React from "react";
import PropTypes from "prop-types";

import {withRouter, Route, Redirect} from 'react-router-dom'
import {getJWT, logout, isLoggedIn} from "./auth.js";


function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target, source) {
	let output = Object.assign({}, target);
	if (isObject(target) && isObject(source)) {
		Object.keys(source).forEach(key => {
			if (isObject(source[key])) {
				if (!(key in target))
					Object.assign(output, { [key]: source[key] });
				else
					output[key] = mergeDeep(target[key], source[key]);
			} else {
				Object.assign(output, { [key]: source[key] });
			}
		});
	}
	return output;
}

const Settings = {
	get(key){
		let data = null;
		try {
			data = JSON.parse(localStorage.getItem("settings") || "---");
		} catch(e) {
			data = {
				log: {
					enableLogExpansion: window.matchMedia("(min-width: 660px)").matches,
					expandLast: false,
					autoScroll: false //window.matchMedia("(min-width: 660px)").matches
				},
				stats: {
					hide: {
						// proj: {
						//   line: false
						// }
					},
					xType: "commits"
				}
			};
		}

		if(key){
			key = key.split(".");
			let d = data;
			for(const k of key){
				if(k in d){
					d = d[k];
				} else {
					return null;
				}
			}

			return d;
		} else {
			return data;
		}
	},
	getFlat(){
		const data = Settings.get();
		const acc = {};
		for(const key1 of ["log", "stats"]){
			for(const key2 in data[key1]){
				acc[`${key1}.${key2}`] = data[key1][key2];
			}
		}
		return acc;
	},
	set(key, value){
		if(typeof value === "undefined"){
			localStorage.setItem("settings", key)
		} else {
			key = key.split(".").reverse();
			let v = key.reduce((acc,v, i) => {return {[v]: acc};}, value)

			localStorage.setItem("settings", 
				JSON.stringify(
					mergeDeep(Settings.get(), v)
				)
			);
		}
	}
};

window.Settings = Settings;

const withFetcher = (Component) => withRouter(
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
				api(this, ...a)
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
			return req;
		}

		render(){
			return <Component {...this.props} fetch={(...a)=>this.fetch(...a)}/>;
		}
	}
);

class RelDate extends React.Component {
	static propTypes = { date: PropTypes.instanceOf(Date) };

	constructor(props){
		super(props);
		this.state = {
			text: humanDate(this.props.date)
		}
	}

	update(){
		const newText = humanDate(this.props.date);
		if(newText !== this.state.text){
			this.setState({text: newText});
		}
	}

	componentDidMount(){
		this.updateID = setInterval(()=>{
			this.update();
		}, 30*1000);
	}

	componentDidUpdate(){
		const newText = humanDate(this.props.date);
		if(newText !== this.state.text){
			this.setState({text: newText});
		}
	}

	componentWillUnmount(){
		clearInterval(this.updateID);
	}

	render(){
		return <span title={formatDate(this.props.date)}>{this.state.text}</span>;
	}
}


function PrivateRoute({component: Component, render, authed = isLoggedIn, ...rest}) {
	return (
		<Route
			{...rest}
			render={(props) => authed()
				? ( Component ? <Component {...props}/> : render(props))
				: <Redirect to={{pathname: "/login", state: {from: props.location}}} />}
		/>
	);
}

PrivateRoute.propTypes = {
	component: PropTypes.element,
	render: PropTypes.func,
	auth: PropTypes.func
};

const StopPromise = {
	then: (v,e) => StopPromise,
	catch: (e) => StopPromise
};

const makeCancelable = (p) => {
	let cancelled = false;
	const newPromise = new Promise((res, rej) => {
		p.then(
			val => cancelled ? StopPromise : res(val),
			err => cancelled ? StopPromise : rej(err))
	});
	newPromise.cancel = () => cancelled = true;
	return newPromise;
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
	let diffSeconds = Math.round(diff / 1000);
	let diffMinutes = Math.round(diff / 1000 / 60);
	let diffHours = Math.floor(diff / 1000 / 60 / 60);

	if(diffMinutes > 60){
		if(diffHours > 24){
			return formatDate(date);
		} else {
			return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
		}
	} else {
		if(diffMinutes === 0){
			if(diffSeconds < 30){
				return "just now";
			}
			return "less than a minute ago";
		} else {
			return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
		}
	}
}

const api = (comp, url, settings={}) => {
	return fetch(url,
		{
			...settings,
			headers: {
				"Authorization": "Bearer "+getJWT(),
				...settings.headers
			},
			method: (settings.body ? "POST" : "GET"),
			body: typeof settings.body === "object" ? JSON.stringify(settings.body) : settings.body
		})
		.then(function(res) {
			if(res.ok) {
				return res;
			} else return Promise.reject(res);
		}).catch((res)=>{
			if(comp && (res.status === 401 || res.status === 403)){
				logout();
				comp.props.history.push("/");
				return StopPromise;
			} else{
				return Promise.reject(res);
			}
		});
};


function hash(str, start=5361) {
	let hash = start,
	i = str.length;

	while(i) {
		hash = (hash * 33) ^ str.charCodeAt(--i);
	}

	return hash >>> 0;
}

function strToColor(str, start=5361){
	return Math.round(hash(str, start)).toString(16).substring(0,6);
}

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
	<div className="loading">
		<div style={{opacity: props.opacity ? props.opacity : "0.4", fontSize: props.size ? props.size : null}}>
			<span/>
		</div>
	</div>;

Loading.propTypes = {
	opacity: PropTypes.number,
	size: PropTypes.string
}

const Errors = (props) =>
	<div className="errors" style={{color: props.color || "black"}}>
		{props.children || "An error occured"}
	</div>;

Errors.propTypes = {
	color: PropTypes.string
}

// fetch("/api/files/rename", {
//     method: "POST",
// 	headers: {Authorization: "Bearer "+localStorage.getItem("jwt"), "Content-Type": "application/json"},
//     body: JSON.stringify({"user": "me"}),
// }).then((r)=>r.json()).then(console.log)


export {api, formatDate, formatTime, humanDate, pad, makeCancelable, StopPromise, Loading, Errors, withFetcher, strToColor, PrivateRoute, RelDate, Settings};