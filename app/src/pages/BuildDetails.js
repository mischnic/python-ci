import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {formatDate, humanDate, makeCancelable} from "../utils.js";

class BuildDetails extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: {

			},
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
		if(this.props.info.data.commits.length > 0){
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
		const req = makeCancelable(fetch(this.getURL(file))
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
			fetch(this.getURL("status"))
				.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
				.then(res => res.json())
				.then(({status}) => {
					if(status !== "pending"){
						stop();
						this.props.info.reload();
					} 
					
				});

		fetch(this.getURL("build"))
			.then(res => !res.ok ? Promise.reject({status: res.status, text: res.statusText}) : res)
			.then(res => res.text())
			.then(() => {
					this.setState({rebuilding: true});
					this.rebuildInterval= setInterval(() => checkStatus(), 1000);
				}
				, console.error);
			// .then(res => this.setState(), () => this.setState());
	}

	render(){
		const {proj, hash} = this.props.match.params;
		const c = this.props.info.data.commits.find((v)=> v.commit.ref === hash);
		if(c){
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
									<a href={commit.url}>{commit.ref}</a> ({humanDate(commit.date)})<br/>
								</div>
								<div style={{flex: "1 1 30%"}}>
									<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
									took {build.duration.toFixed(1)} seconds <br/>
								</div>
								<div style={{flex: "1 1 10%", textAlign: "right"}}>
									<a className="button" onClick={() => this.rebuild()}>
										<i className={`fa fa-refresh ${this.state.rebuilding ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>Rebuild
									</a>
								</div>
							</div>
						</div>
						<div className="files">
							<div className="window" style={{flex: "1 1 30%"}}>
								Artifacts: <br/>
								<a target="_blank" href={this.getURL("pdf")}>PDF</a>
							</div>
							<div className="window log" style={{flex: "1 1 70%"}}>
								{
									(this.state.files.log && this.state.files.log.content) ?
									<pre><code>{this.state.files.log.content}</code></pre>
									: "Loading logfile ..."
								}
							</div>
						</div>
					</div>
				</div>
			);
		} else {
			return null;
		}
	}
		
}

export default BuildDetails;