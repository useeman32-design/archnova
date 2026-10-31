#!/usr/bin/env python3
"""Download a small, verifiable Poly Haven starter collection for ArchNova.

All downloaded assets are CC0. This script records the official metadata and MD5s,
keeps the original glTF file names/relative dependencies, and avoids guessed CDN paths.
"""
from __future__ import annotations
import hashlib, json, os, pathlib, re, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'polyhaven'
UA = 'ArchNovaAssetImport/0.1 (local asset integration)'
MODELS = [
    'sofa_02', 'modern_arm_chair_01', 'mid_century_lounge_chair',
    'modern_coffee_table_01', 'dining_chair_02', 'modern_wooden_cabinet',
    'metal_office_desk', 'electric_stove', 'modern_ceiling_lamp_01',
    'street_lamp_01', 'modular_street_seating', 'quiver_tree_02',
    'concrete_cat_statue', 'outdoor_table_chair_set_01',
]
TEXTURES = {
    'brushed_concrete': 'concrete',
    'brick_pavement': 'brick',
    'american_walnut_veneer': 'wood',
    'stone_pavers': 'stone',
    'asphalt_01': 'asphalt',
    'interlocking_concrete_pavers': 'interlocking-pavement',
}

def get_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)

def get_bytes(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def safe_rel(path):
    p = pathlib.PurePosixPath(path.replace('\\', '/'))
    if p.is_absolute() or '..' in p.parts:
        raise ValueError(f'Unsafe dependency path: {path}')
    return p

def save_verified(url, md5, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and hashlib.md5(target.read_bytes()).hexdigest() == md5:
        return target.stat().st_size
    data = get_bytes(url)
    actual = hashlib.md5(data).hexdigest()
    if actual != md5:
        raise RuntimeError(f'MD5 mismatch {target}: expected {md5}, got {actual}')
    target.write_bytes(data)
    return len(data)

def import_model(asset_id):
    info = get_json(f'https://api.polyhaven.com/info/{asset_id}')
    files = get_json(f'https://api.polyhaven.com/files/{asset_id}')
    version = files.get('gltf', {}).get('1k') or files.get('gltf', {}).get('2k')
    if not version or 'gltf' not in version:
        raise RuntimeError(f'No downloadable glTF for {asset_id}')
    main = version['gltf']
    folder = OUT / 'models' / asset_id
    local_main = folder / pathlib.PurePosixPath(main['url'].split('/')[-1]).name
    total = save_verified(main['url'], main['md5'], local_main)
    downloaded = [{'path': str(local_main.relative_to(ROOT)), 'url': main['url'], 'md5': main['md5'], 'size': total, 'role': 'gltf'}]
    for rel, dependency in main.get('include', {}).items():
        target = folder.joinpath(*safe_rel(rel).parts)
        n = save_verified(dependency['url'], dependency['md5'], target)
        total += n
        downloaded.append({'path': str(target.relative_to(ROOT)), 'url': dependency['url'], 'md5': dependency['md5'], 'size': n, 'role': 'dependency'})
    return {
        'id': asset_id,
        'name': info.get('name', asset_id),
        'type': 'model',
        'source': 'Poly Haven',
        'sourceUrl': f'https://polyhaven.com/a/{asset_id}',
        'license': 'CC0 1.0 Universal',
        'licenseUrl': 'https://polyhaven.com/license',
        'author': ', '.join(info.get('authors', {}).keys()),
        'polycount': info.get('polycount'),
        'dimensionsMm': info.get('dimensions'),
        'dimensionsM': [round(float(v) / 1000, 6) for v in info.get('dimensions', [])],
        'tags': info.get('tags', []),
        'categories': info.get('categories', []),
        'modelUrl': '/' + str(local_main.relative_to(ROOT / 'public')),
        'modelFile': str(local_main.relative_to(ROOT)),
        'fileMd5': main['md5'],
        'files': downloaded,
        'downloadBytes': total,
        'polyhavenCredit': 'Powered by Poly Haven',
    }

def import_texture(asset_id, category):
    info = get_json(f'https://api.polyhaven.com/info/{asset_id}')
    files = get_json(f'https://api.polyhaven.com/files/{asset_id}')
    size_key = '1k' if '1k' in files.get('Diffuse', {}) else ('2k' if '2k' in files.get('Diffuse', {}) else None)
    if not size_key:
        raise RuntimeError(f'No 1k/2k Diffuse maps for {asset_id}')
    folder = OUT / 'textures' / asset_id
    outputs = {}
    downloaded = []
    total = 0
    # Keep only PBR maps usable by Three.js, retaining OpenGL normal maps.
    choices = [('Diffuse', 'color'), ('nor_gl', 'normal'), ('Rough', 'roughness'), ('Metal', 'metalness'), ('arm', 'arm'), ('ao', 'ao'), ('Displacement', 'displacement')]
    for api_key, semantic in choices:
        variants = files.get(api_key, {})
        if size_key not in variants:
            continue
        formats = variants[size_key]
        file_info = formats.get('jpg') or formats.get('png')
        if not file_info:
            continue
        target = folder / pathlib.PurePosixPath(file_info['url'].split('/')[-1]).name
        n = save_verified(file_info['url'], file_info['md5'], target)
        total += n
        outputs[semantic] = '/' + str(target.relative_to(ROOT / 'public'))
        downloaded.append({'path': str(target.relative_to(ROOT)), 'url': file_info['url'], 'md5': file_info['md5'], 'size': n, 'role': semantic})
    if 'color' not in outputs:
        raise RuntimeError(f'Missing color map: {asset_id}')
    return {
        'id': asset_id,
        'name': info.get('name', asset_id),
        'type': 'material',
        'category': category,
        'source': 'Poly Haven',
        'sourceUrl': f'https://polyhaven.com/a/{asset_id}',
        'license': 'CC0 1.0 Universal',
        'licenseUrl': 'https://polyhaven.com/license',
        'author': ', '.join(info.get('authors', {}).keys()),
        'maps': outputs,
        'resolution': size_key,
        'files': downloaded,
        'downloadBytes': total,
        'polyhavenCredit': 'Powered by Poly Haven',
    }

def main():
    models = []
    for i, asset_id in enumerate(MODELS, 1):
        print(f'[{i}/{len(MODELS)}] model {asset_id}', flush=True)
        models.append(import_model(asset_id))
    materials = []
    for i, (asset_id, category) in enumerate(TEXTURES.items(), 1):
        print(f'[{i}/{len(TEXTURES)}] texture {asset_id}', flush=True)
        materials.append(import_texture(asset_id, category))
    manifest = {
        'schemaVersion': 1,
        'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'source': 'Poly Haven API',
        'sourceApi': 'https://api.polyhaven.com/our-api',
        'licenseNotice': 'All listed assets are CC0 1.0. Attribution is not required; ArchNova includes Powered by Poly Haven credit as courtesy.',
        'models': models,
        'materials': materials,
    }
    out = ROOT / 'public' / 'assets' / 'archnova-asset-manifest.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Wrote {out}; models={len(models)}, materials={len(materials)}, bytes={sum(x["downloadBytes"] for x in models + materials)}')

if __name__ == '__main__':
    main()
