'use client';
import {Component, type ReactNode} from 'react';
export default class FeatureBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
 state = {failed: false};
 static getDerivedStateFromError() {return {failed: true};}
 render() {return this.state.failed ? <div className="feature-loading" role="alert"><p>화면을 불러오지 못했어요. 연결을 확인한 뒤 다시 열어주세요.</p><button className="secondary" onClick={() => location.reload()}>새로고침</button></div> : this.props.children;}
}
