import React from "react";
import {Link} from "react-router-dom";
import reactStringReplace from 'react-string-replace';

import "./BuildDetails.css";
import pdf_img from "../assets/pdf.png";
import zip_img from "../assets/Orion_zip-file.png";

import {Loading, Errors, formatTime, withFetcher, RelDate} from "../utils.js";
import BuildLog from "./BuildLog.js"
import {GitUser} from "./BuildCommon.js";
import {getJWT} from "../auth.js";

function commitURL(id, sha){
	return `https://github.com/${id}/commit/${sha}`;
}

export default withFetcher(class BuildDetails extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: {},
			showWords: false
		};

		this.hash = this.props.match.params.hash;
		if(this.props.info.data){
			if(this.hash === "latest"){
				this.hash = this.props.info.data.latest;
			}
			this.commit = this.props.info.data.list.find((v)=> v.commit.ref === this.hash);

			const commitIndex = this.props.info.data.list.indexOf(this.commit);
			if(this.props.info.data.list[commitIndex+1]){
				this.prevHash = this.props.info.data.list[commitIndex+1].commit.ref;
			}
		}
	}

	componentDidMount(){
		if(this.props.info.data){
			if(this.commit) this.load("log");

			const commitIndex = this.props.info.data.list.indexOf(this.commit);
			if(this.props.info.data.list[commitIndex+1]){
				this.load(`diff/${this.props.info.data.list[commitIndex+1].commit.ref}`, res=>res.json(), "diff");
			}
		}
	}

	componentWillReceiveProps(nextProps){
		if(nextProps.info.data && nextProps.match.params.hash !== this.hash){
			this.hash = nextProps.match.params.hash;
			if(this.hash === "latest"){
				this.hash = nextProps.info.data.latest;
			}

			this.commit = nextProps.info.data.list.find((v)=> v.commit.ref === this.hash);
			const commitIndex = this.props.info.data.list.indexOf(this.commit);
			if(this.props.info.data.list[commitIndex+1]){
				this.prevHash = this.props.info.data.list[commitIndex+1].commit.ref;
			}
		} else{
			this.commit = nextProps.info.data.list.find((v)=> v.commit.ref === this.hash);
		}


		if(nextProps.info.data.list.find((v)=> v.commit.ref === this.hash).build.status === "success"){
			this.load("log");
		}
	}

	getURL(file, query=false){
		if(file) file = "/"+file;
		return `/api/${this.props.match.params.proj}/${this.hash}${file}`+
				(query?`?token=${getJWT()}`:"");
	}

	load(file, type=(res)=>res.text(), as=file){
		this.setState((state)=> ({files: {...state.files, [as]: {loading: true}}}) );
		return this.props.fetch(this.getURL(file))
			.then(type)
			.then(res => this.setState({
					files: {
						...this.state.files,
						[as]: {
							content: res,
							loading: false,
							error: false,
						}
					}
				}))
			.catch(() => this.setState({
					files: {
						...this.state.files,
						[as]: {
							loading: false,
							error: true
						},
					}
				}, ))
	}

	rebuild(){
		this.props.fetch(this.getURL("build"));
	}

	render(){
		const {proj} = this.props.match.params;
		const {build, commit} = this.commit || {};
		if(!this.hash) return <Errors>An error occured</Errors>;
		return (
			<div>
				<h1><Link to="." title="Go Back to List">{proj}</Link> &gt; {this.hash.substring(0,7)}</h1>
				<div className="buildDetails">
					{
					(!this.commit || !this.commit.build) ?
					<Errors>
						<div style={{textAlign: "center"}}>
							Build could not be found<br/><br/>
							<button onClick={() => this.rebuild()}>
								<i className={"fa fa-refresh"} style={{marginRight: "4px"}}/>Build
							</button>
						</div>
					</Errors>
						:
					<React.Fragment>
						<div className="details" key="details">
							<div className={`window build buildStatus ${build.status}`}>
								<div>
									<GitUser name={commit.author_name} avatar={commit.author_avatar}/>
									{
										reactStringReplace(commit.msg, /#([0-9]+)/g, (p, i)=> <a key={i} target="_blank" href={`https://github.com/${this.props.info.data.id}/issues/${p}`}>#{p}</a>)
									}<br/>
									<a title="Open on Github" href={commitURL(this.props.info.data.id, commit.ref)} target="_blank">{commit.ref}</a> (<RelDate date={commit.date}/>)<br/>
								</div>
								<div>
									<span>started <RelDate date={build.start}/> </span><br/>
									{build.duration ? <span>took {formatTime(build.duration)}</span> : null} <br/>
								</div>
								<div>
									<button onClick={() => this.rebuild()} {...{disabled: build.status === "pending"}}>
										<i className={`fa fa-refresh ${build.status === "pending" ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>{build.status === "pending" ? "Building" : "Rebuild"}
									</button>
								</div>
							</div>
						</div>
						<div className="files" key="files">
							<div className="window artifacts">
								{
									build.artifacts && Object.keys(build.artifacts).length > 0 &&
									<div>
										Artifacts:<br/>
										<ol>
											{
												Object.keys(build.artifacts).map(v=>{
													let content = build.artifacts[v];
													if(content === "PDF"){
														content = <img alt="PDF" src={pdf_img}/>;
													} else if(content === "ZIP"){
														content = <img alt="ZIP" src={zip_img}/>;
													}
													return (
													<li key={v}>
														<a target="_blank" title={build.artifacts[v] !== content && build.artifacts[v]} href={this.getURL(v, true)}>
															{content}
														</a>
													</li>);
												})
											}
										</ol>
									</div>
								}
								{
									build.stats && build.stats.counts ?
									(
									(()=>{
										const format = (name, text) => {
											const style = name.startsWith("Section") ? {paddingLeft: ".7em"} :
														  name.startsWith("Subsection") ? {paddingLeft: "1.4em"} : null;
											return <li key={name} style={style}>{name}: {text}</li>;
										}
										if(this.state.showWords){
											const words = build.stats.counts.words;
											const [sumc/*, text, headers, outside, headersN, floatsN, mathsI, mathsD*/] = words.total;

											return (
											<div>
												<span>Total words: {sumc} <a tabIndex="0" onClick={()=>this.setState({showWords: false})} style={{opacity: 0.3}}>Show Letters</a></span>
												<ol>
												{
													words.chapters.map((v)=>{
														let [name, text/*, headers, captions, headersH, floatsH, inlinesH, displayedH*/] = v;
														return format(name, text);
													})
												}
												</ol>
											</div>);
										} else {
											const letters = build.stats.counts.letters;
											const [sumc/*, text, headers, outside, headersN, floatsN, mathsI, mathsD*/] = letters.total;

											return (
											<div>
												<span>Total letters: {sumc} <a tabIndex="0" onClick={()=>this.setState({showWords: true})} style={{opacity: 0.3}}>Show Words</a></span>
												<ol>
												{
													letters.chapters.map((v)=>{
														let [name, text/*, headers, captions, headersH, floatsH, inlinesH, displayedH*/] = v;
														return format(name, text);
													})
												}
												</ol>
											</div>);
										}
									})()
									) : null
								}
								{
									(this.state.files["diff"] && this.state.files["diff"].content &&
										this.state.files["diff"].content.length > 0) ?
										(<div>
											<a title="Compare on Github" href={`https://github.com/${this.props.info.data.id}/compare/${this.prevHash}...${this.hash}`} target="_blank">Additional commits</a> since last build:
											<ol>
												{
													this.state.files["diff"].content.map(v=>(
														<li key={v.ref}>{v.msg.split("\n")[0]} <a title="Open on Github" href={commitURL(this.props.info.data.id, v.ref)} target="_blank">({v.ref.substring(0,7)})</a></li>
													))
												}
											</ol>
										</div>)
										:
										(<div>
											<a title="Compare on Github" href={`https://github.com/${this.props.info.data.id}/compare/${this.prevHash}...${this.hash}`} target="_blank">Compare to last build's commit</a>
										</div>)
								}
							</div>
							<div className="window log">
								{
									(()=>{
										if(this.state.files["log"]){
											if(this.state.files["log"].error){
												return <Errors color="white"/>;
											} else if(!this.state.files["log"].content || this.state.files["log"].loading){
												return <Loading/>;
											}
											return <BuildLog events={this.props.events} proj={proj} hash={this.hash} lang={this.props.info.data.language} status={build.status} content={this.state.files["log"].content}/>
										} else return <Loading/>;
									})()
								}
							</div>
						</div>
					</React.Fragment>
					}
				</div>
			</div>
		);
	}

});