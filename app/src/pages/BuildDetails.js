import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {formatDate, humanDate} from "../utils.js";

class BuildDetails extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: {

			}
		};
	}

	componentDidMount(){
		if(this.props.info.commits.length > 0){
			this.load("log");
		}
	}

	getURL(file){
		if(file) file = "/"+file;
		return `/api/${this.props.match.params.proj}/${this.props.match.params.hash}${file}`;
	}

	load(file){
		this.setState({files: {[file]: {loading: true}, ...this.state.files}});
		fetch(this.getURL(file))
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
					}));
	}

	render(){
		let {proj, hash} = this.props.match.params;
		let c = this.props.info.commits.find((v)=> v.commit.ref === hash);
		if(c){
			let {build, commit} = c;
			return (
				<div>
					<h1><Link to="." title="Go Back to List">Builds: {proj}</Link> &gt; {hash.substring(0,7)}</h1>
					<div className="buildDetails">
						<div className="details">
							<div className={`window build buildStatus ${build.status}`}>
								<img className="avatar" alt="" src={commit.author.avatar_url}/>{commit.author.name}<br/>
								{commit.msg}<br/>
								<a href={commit.url}>{commit.ref}</a> ({humanDate(commit.date)})<br/>
								<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
								took {build.duration.toFixed(1)} seconds <br/>
							</div>
						</div>
						<div className="files">
							<div className="window" style={{flex: "1 1 30%"}}>
								Artifacts: <br/>
								<a href={this.getURL("pdf")}>PDF</a>
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