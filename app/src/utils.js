import {getJWT, logout} from "./auth.js";

function pad(n, width, z) {
	z = z || "0";
	n = n + "";
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function formatDate(date){
	return pad(date.getDate(), 2)+"."+pad(date.getMonth()+1, 2)+"."+date.getFullYear()+" - " +
		pad(date.getHours(), 2)+":"+pad(date.getMinutes(), 2);
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
		return `${diffHours} mins ago`;
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

const csv = (text, delimiter = "\t", header = true) => {
	let lines = text.split("\n");
	let data = {};
	let lineParser = l => l.split(delimiter);

	if(header){
		data.header = lineParser(lines[0]);
		lines.shift();
	} else {
		data.header = null;
	}

	data.body = lines.map(lineParser);
	return data;
};


// fetch("/api/files/rename", {
//     method: "POST",
// 	headers: {Authorization: "Bearer "+localStorage.getItem("jwt"), "Content-Type": "application/json"},
//     body: JSON.stringify({"user": "me"}),
// }).then((r)=>r.json()).then(console.log)


export {api, csv, formatDate, humanDate};