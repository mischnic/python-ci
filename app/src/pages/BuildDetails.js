import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {formatDate, formatTime, humanDate, makeCancelable} from "../utils.js";
import {Loading, api} from "../utils.js";

const logFormatting = {
	latex:[
		[">>> ", "command"],
		[/Package [a-zA-z]+ Warning:/, "warning"],
		[/^\(([a-zA-z]+)\)/, "warning"],
		[/LaTeX (?:[a-zA-z]+ )?Warning:/, "warning"],
		["Overfull \\hbox", "warning"],
		["Underfull \\hbox", "warning"]
	]
};

class BuildDetails extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: {},
			rebuilding: false
		};

		this.rebuildInterval = null;
		this.loadPromises = [];
		this.loadPromises.remove = function(v){
			v.cancel();
			const i = this.indexOf(v);
			if(i > -1){
				this.splice(i, 1);
			}
		};
	}

	componentDidMount(){
		if(this.props.info.data){
			this.load("log");
		}
	}

	componentWillUnmount(){
		if(this.rebuildInterval !== null){
			clearInterval(this.rebuildInterval);
			this.rebuildInterval = null;
		}
		for(const p of this.loadPromises){
			this.loadPromises.remove(p);
		}
	}

	getURL(file){
		if(file) file = "/"+file;
		return `/api/${this.props.match.params.proj}/${this.props.match.params.hash}${file}`;
	}

	load(file){
		this.setState({files: {[file]: {loading: true}, ...this.state.files}});
		const req = makeCancelable(api(this, this.getURL(file))
			.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
			.then(res => res.text())
			.then(res => this.setState({
					files: {
						[file]: {
							content: res,
							loading: false
						}
					}
				}), () => this.setState(
					{
						files: {
							[file]: {
								loading: false,
								error: true
							},
						...this.state.files
						}
					}))
			.then(() => this.loadPromises.remove(req)));

		this.loadPromises.push(req);
	}

	rebuild(){
		const stop = () => {
			this.setState({rebuilding: true});
			if(this.rebuildInterval !== null) {
				clearInterval(this.rebuildInterval);
				this.rebuildInterval = null;
			}
		};

		const checkStatus = () => 
			api(this.getURL("status"))
				.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
				.then(res => res.json())
				.then(({status}) => {
					if(status !== "pending"){
						stop();
						this.props.info.reload();
					} 
					
				});

		api(this.getURL("build"))
			.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
			.then(res => res.text())
			.then(() => {
					this.setState({rebuilding: true});
					this.rebuildInterval= setInterval(() => checkStatus(), 1000);
					this.props.info.reload();
				}
				, console.error);
	}

	render(){
		const {proj, hash} = this.props.match.params;
		if(this.props.info.data.list){
			const c = this.props.info.data.list.find((v)=> v.commit.ref === hash);
			if(c){
				const logF = logFormatting[this.props.info.data.language];
				const {build, commit} = c;
				return (
					<div>
						<h1><Link to="." title="Go Back to List">Builds: {proj}</Link> &gt; {hash.substring(0,7)}</h1>
						<div className="buildDetails">
							<div className="details">
								<div className={`window build buildStatus ${build.status}`} style={{display: "flex"}}>
									<div style={{flex: "1 1 50%"}}>
										<img className="avatar" alt="" src={commit.author.avatar_url}/>{commit.author.name}<br/>
										{commit.msg}<br/>
										<a href={commit.url}>{commit.ref}</a> <i className="fa fa-external-link"/> ({humanDate(commit.date)})<br/>
									</div>
									<div style={{flex: "1 1 30%"}}>
										<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
										{build.duration ? <span>took {formatTime(build.duration)}</span> : null} <br/>
									</div>
									<div style={{flex: "1 1 10%", textAlign: "right"}}>
										<a className="button" onClick={() => this.rebuild()}>
											<i className={`fa fa-refresh ${this.state.rebuilding ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>Rebuild
										</a>
									</div>
								</div>
							</div>
							<div className="files">
								<div className="window artifacts" style={{flex: "1 1 30%"}}>
									<div>
										Artifacts: <br/>
										<ol>
											<li><a target="_blank" href={this.getURL("pdf")}>PDF</a></li>
										</ol>
									</div>
									{
										build.stats.counts ? 
										( 
										(()=>{
											const letters = build.stats.counts.letters;
											const [sumc/*, text, headers, outside, headersN, floatsN, mathsI, mathsD*/] = letters.total;

											return (
											<div>
												<span>Total letters: {sumc}</span>
												<ol>
												{
													letters.chapters.map((v)=>{
														let [name, text/*, headers, captions, headersH, floatsH, inlinesH, displayedH*/] = v;
														const style = name.startsWith("Section") ? {paddingLeft: ".7em"} : null;
														return <li key={name} style={style}>{name}: {text}</li>;
													})
												}
												</ol>
											</div>);
										})()
										) : null
									}
								</div>
								<div className="window log" style={{flex: "1 1 70%"}}>
									{
										(this.state.files.log && this.state.files.log.content) ?
										<pre>
										<code>
											{
											this.state.files.log.content
												.split("\n").map((v, i) => {
													const key = logF.findIndex(e => (
														typeof e[0] === "object" ?
															(e[0].test(v)) :
															(v.indexOf(e[0]) === 0) 
													));
													return <div className={key>-1? logF[key][1] :""} key={i}>{v}</div>;
												})
											}
										</code>
										</pre>
										: <Loading/>
									}
								</div>
							</div>
						</div>
					</div>
				);
			}
		}
		return null;
	}

}

export default BuildDetails;