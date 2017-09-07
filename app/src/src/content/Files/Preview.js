import React from 'react';
import {withDialog} from '../../components/Dialog.js';
import { api, csv } from '../../utils.js';

import './Preview.css';

const Preview = withDialog(class Preview extends React.Component {
	constructor(props){
		super(props);
		this.state = {
			content: undefined,
			header: this.props.file.name,
			style: {}
		};
	}

	refresh(props = this.props){
		let {file} = props;
		let {name, mime} = file;
		let header = name;
		if(mime.startsWith('image')){
			this.setState({
				header,
				content: '',
				style: {
					backgroundImage: 'url("'+file.getReqPath()+'")',
					backgroundSize: 'contain',
					backgroundRepeat: 'no-repeat',
					backgroundPosition: '50%',
					backgroundOrigin: 'content-box'
				}
			});
		} else{
			api(this, file.getAPIPath(), {}, 'text').then((res)=>{
				let style = {}, content;
				if(mime === 'text/csv'){
					let c = csv(res);
					content = 
						<table>
							<tbody>
							{c.header &&
								<tr>{c.header.map((d,i)=> <th key={i}>{d}</th> )}</tr>
							}
							{
								c.body.map((rd,ri)=>(
									<tr key={ri}>{rd.map((d,i)=> <td key={i}>{d}</td> )}</tr>
								))
							}
							</tbody>
						</table>;
				} else if(name.endsWith('.txt')){
					content = res;
					style = { whiteSpace: 'pre' };
				} else {
					let type;
					if(mime == 'application/x-tex'){
						type = 'tex';
					} else if(mime == 'text/x-markdown'){
						type = 'markdown';
					} else if(mime == 'application/x-sh'){
						type = 'shell';
					} else if(mime == 'application/x-httpd-php'){
						type = 'php';
					}  else if(file.isText() && name.indexOf('apache') != -1 && name.endsWith('.conf')){
						type = 'apache';
					}
					let d = type ? window.hljs.highlight(type, res) : window.hljs.highlightAuto(res);
					header = <span>{name} <span style={{fontSize: '0.5em', verticalAlign: 'middle'}}> {d.language} </span></span>;
					content = <pre dangerouslySetInnerHTML={{__html: d.value}}></pre>;
				}
				this.setState({
					content,
					style,
					header
				}, ()=>{
					if(this.content){
						this.content.scrollTop = 0;
					}
				});
			});
		}
	}

	componentWillMount(){
		this.refresh();
	}

	componentWillReceiveProps(nextProps){
		this.refresh(nextProps);
	}

	render(){
		return (
		<div id='preview'>
				<div className='header'>
					<span> {this.state.header} </span>
					<span onClick={this.props.hide}>X</span>
				</div>
				<div className='contentWrapper'>
					<div className='content' style={this.state.style || {}} ref={(r)=> this.content = r}>
						{ this.state.content }
					</div>
				</div>
		</div>);
	}
});

export default Preview;